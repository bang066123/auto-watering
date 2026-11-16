"""
audit_dataset.py - Kiểm định chất lượng dataset trước khi huấn luyện
Đề tài: Hệ Thống Trinh Sát Phát Hiện Hung Khí - PTIT

VÌ SAO CẦN BƯỚC NÀY?
--------------------
Trong học sâu, chất lượng dữ liệu quyết định trần độ chính xác. Mô hình
không thể vượt qua giới hạn do dữ liệu bẩn đặt ra, dù có train bao nhiêu
epochs. Script này soi 6 nhóm lỗi thường gặp:

  1. Tỉ lệ ảnh nền (background) - quá cao sẽ kéo tụt Recall
  2. Mất cân bằng lớp gun / knife
  3. Ảnh thiếu nhãn hoặc nhãn thiếu ảnh (orphan files)
  4. Tọa độ bounding box sai chuẩn (ngoài [0,1], w/h = 0)
  5. Nhãn trùng lặp hoàn toàn trong cùng một ảnh
  6. Bounding box siêu nhỏ (< 0.3% diện tích ảnh) - thường là nhãn rác
  7. Rò rỉ dữ liệu: cùng một ảnh xuất hiện ở cả train và val/test

CÁCH DÙNG
---------
    python src/01_data_prep/audit_dataset.py
    python src/01_data_prep/audit_dataset.py --fix        # tự sửa lỗi an toàn
"""

import os
import sys
import glob
import hashlib
import argparse
from collections import Counter, defaultdict

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
DATASET_DIR = os.path.join(PROJECT_ROOT, "data", "dataset")
CLASS_NAMES = {0: "gun", 1: "knife"}
IMG_EXT = (".jpg", ".jpeg", ".png", ".bmp", ".webp")

# Ngưỡng khuyến nghị
BG_RATIO_MAX = 0.20     # Ultralytics khuyến nghị 0-10%, tối đa chấp nhận 20%
TINY_BOX_AREA = 0.003   # 0.3% diện tích ảnh
IMBALANCE_MAX = 2.5     # Tỉ lệ lớp nhiều nhất / ít nhất


def list_images(split):
    d = os.path.join(DATASET_DIR, split, "images")
    files = []
    for ext in IMG_EXT:
        files += glob.glob(os.path.join(d, f"*{ext}"))
        files += glob.glob(os.path.join(d, f"*{ext.upper()}"))
    return sorted(set(files))


def label_path_for(img_path):
    base = os.path.splitext(os.path.basename(img_path))[0]
    split_dir = os.path.dirname(os.path.dirname(img_path))
    return os.path.join(split_dir, "labels", base + ".txt")


def parse_label(path):
    """Trả về (boxes, errors). boxes = [(cls, x, y, w, h), ...]"""
    boxes, errors = [], []
    if not os.path.exists(path):
        return boxes, ["missing"]
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read().strip()
    except Exception as e:
        return boxes, [f"unreadable: {e}"]

    if not content:
        return boxes, []  # ảnh nền hợp lệ

    for i, line in enumerate(content.split("\n"), 1):
        parts = line.strip().split()
        if not parts:
            continue
        if len(parts) != 5:
            errors.append(f"dòng {i}: có {len(parts)} giá trị thay vì 5")
            continue
        try:
            cls = int(float(parts[0]))
            x, y, w, h = (float(v) for v in parts[1:])
        except ValueError:
            errors.append(f"dòng {i}: không phải số")
            continue
        if cls not in CLASS_NAMES:
            errors.append(f"dòng {i}: class_id={cls} không hợp lệ")
            continue
        if not all(0.0 <= v <= 1.0 for v in (x, y, w, h)):
            errors.append(f"dòng {i}: tọa độ ngoài [0,1]")
            continue
        if w <= 0 or h <= 0:
            errors.append(f"dòng {i}: width/height bằng 0")
            continue
        boxes.append((cls, x, y, w, h))
    return boxes, errors


def file_hash(path, chunk=65536):
    h = hashlib.md5()
    try:
        with open(path, "rb") as f:
            while True:
                b = f.read(chunk)
                if not b:
                    break
                h.update(b)
    except Exception:
        return None
    return h.hexdigest()


def audit():
    report = {}
    hashes = defaultdict(list)
    problems = defaultdict(list)

    print("=" * 70)
    print("   KIỂM ĐỊNH CHẤT LƯỢNG DATASET - HỆ THỐNG PHÁT HIỆN HUNG KHÍ")
    print("=" * 70)

    for split in ("train", "val", "test"):
        images = list_images(split)
        if not images:
            print(f"\n[{split.upper()}] Không tìm thấy ảnh nào.")
            continue

        cls_counter = Counter()
        bg_count = 0
        box_total = 0
        tiny_boxes = 0
        missing_label = 0
        bad_files = []
        imgs_per_class = defaultdict(int)

        for img in images:
            lbl = label_path_for(img)
            boxes, errs = parse_label(lbl)

            if errs == ["missing"]:
                missing_label += 1
                problems[split].append(f"thiếu nhãn: {os.path.basename(img)}")
                continue
            if errs:
                bad_files.append((img, errs))
                problems[split].append(f"nhãn lỗi: {os.path.basename(img)} -> {errs[0]}")

            if not boxes:
                bg_count += 1
            else:
                seen = set()
                present = set()
                for cls, x, y, w, h in boxes:
                    cls_counter[cls] += 1
                    box_total += 1
                    present.add(cls)
                    if w * h < TINY_BOX_AREA:
                        tiny_boxes += 1
                    key = (cls, round(x, 5), round(y, 5), round(w, 5), round(h, 5))
                    if key in seen:
                        problems[split].append(f"nhãn trùng lặp: {os.path.basename(img)}")
                    seen.add(key)
                for c in present:
                    imgs_per_class[c] += 1

            hsh = file_hash(img)
            if hsh:
                hashes[hsh].append(f"{split}/{os.path.basename(img)}")

        total = len(images)
        bg_ratio = bg_count / total if total else 0

        report[split] = {
            "total": total,
            "bg": bg_count,
            "bg_ratio": bg_ratio,
            "boxes": box_total,
            "classes": dict(cls_counter),
            "imgs_per_class": dict(imgs_per_class),
            "tiny": tiny_boxes,
            "missing_label": missing_label,
            "bad": len(bad_files),
        }

        print(f"\n[{split.upper()}]  {total} ảnh  |  {box_total} bounding box")
        print(f"  Ảnh nền (nhãn rỗng) : {bg_count} ({bg_ratio*100:.1f}%)", end="")
        if bg_ratio > BG_RATIO_MAX:
            print(f"   <-- CAO HƠN NGƯỠNG {BG_RATIO_MAX*100:.0f}%")
        else:
            print("   OK")
        for cid, name in CLASS_NAMES.items():
            n = cls_counter.get(cid, 0)
            ni = imgs_per_class.get(cid, 0)
            print(f"  Lớp {cid} ({name:<5})        : {n} box trên {ni} ảnh")
        if cls_counter:
            mx, mn = max(cls_counter.values()), min(cls_counter.values())
            ratio = mx / mn if mn else 999
            flag = "   <-- MẤT CÂN BẰNG" if ratio > IMBALANCE_MAX else "   OK"
            print(f"  Tỉ lệ lệch lớp      : {ratio:.2f}x{flag}")
        print(f"  Box siêu nhỏ (<0.3%): {tiny_boxes}")
        print(f"  Ảnh thiếu nhãn      : {missing_label}")
        print(f"  File nhãn lỗi       : {len(bad_files)}")

    # Kiểm tra rò rỉ dữ liệu giữa các tập
    print("\n" + "-" * 70)
    print("KIỂM TRA RÒ RỈ DỮ LIỆU (cùng ảnh ở nhiều tập)")
    leaks = {h: v for h, v in hashes.items() if len({p.split("/")[0] for p in v}) > 1}
    if leaks:
        print(f"  PHÁT HIỆN {len(leaks)} ảnh trùng giữa các tập!")
        print("  Đây là lỗi nghiêm trọng: chỉ số mAP sẽ bị thổi phồng không thật.")
        for h, v in list(leaks.items())[:10]:
            print(f"    - {' <-> '.join(v)}")
        if len(leaks) > 10:
            print(f"    ... và {len(leaks) - 10} trường hợp khác")
    else:
        print("  Không có ảnh trùng giữa train/val/test. Tốt.")

    # Ảnh trùng lặp trong cùng một tập
    dups = {h: v for h, v in hashes.items()
            if len(v) > 1 and len({p.split("/")[0] for p in v}) == 1}
    if dups:
        print(f"\n  Có {len(dups)} nhóm ảnh trùng lặp trong cùng một tập "
              f"(làm mô hình học vẹt, nên loại bớt).")

    # ---------------- Khuyến nghị ----------------
    print("\n" + "=" * 70)
    print("   KHUYẾN NGHỊ NÂNG ĐỘ CHÍNH XÁC")
    print("=" * 70)

    tr = report.get("train", {})
    n = 1
    if tr.get("bg_ratio", 0) > BG_RATIO_MAX:
        excess = int(tr["bg"] - tr["total"] * BG_RATIO_MAX)
        print(f"{n}. Tỉ lệ ảnh nền {tr['bg_ratio']*100:.1f}% là quá cao.")
        print(f"   Ảnh nền giúp giảm báo động giả nhưng nhiều quá sẽ dạy mô hình")
        print(f"   'không thấy gì' -> Recall tụt. Nên giảm khoảng {excess} ảnh nền")
        print(f"   để về mức ~15-20%.  Chạy: python src/01_data_prep/audit_dataset.py --fix")
        n += 1
    cls = tr.get("classes", {})
    if cls and max(cls.values()) / max(min(cls.values()), 1) > IMBALANCE_MAX:
        few = min(cls, key=cls.get)
        print(f"{n}. Lớp '{CLASS_NAMES[few]}' có ít mẫu hơn hẳn.")
        print(f"   Bật copy_paste=0.3 trong model_config.yaml (đã bật sẵn) và cân nhắc")
        print(f"   bổ sung ảnh cho lớp này từ nguồn ngoài.")
        n += 1
    if leaks:
        print(f"{n}. XỬ LÝ NGAY các ảnh trùng giữa train và val/test, nếu không")
        print(f"   mAP báo cáo sẽ không phản ánh đúng năng lực thật của mô hình.")
        n += 1
    if tr.get("tiny", 0) > tr.get("boxes", 1) * 0.05:
        print(f"{n}. Nhiều bounding box siêu nhỏ. Cân nhắc train ở imgsz=768 hoặc 960")
        print(f"   để mô hình nhìn rõ chi tiết.")
        n += 1
    if n == 1:
        print("Dataset sạch. Nút thắt nằm ở cấu hình huấn luyện, không phải dữ liệu.")

    return report, problems


def fix_background_ratio(target_ratio=0.18):
    """Chuyển bớt ảnh nền dư thừa sang thư mục dự phòng (không xóa)."""
    split = "train"
    images = list_images(split)
    bgs = []
    for img in images:
        boxes, errs = parse_label(label_path_for(img))
        if not errs and not boxes:
            bgs.append(img)

    total = len(images)
    keep = int(total * target_ratio)
    if len(bgs) <= keep:
        print(f"[OK] Tỉ lệ ảnh nền đã hợp lý ({len(bgs)}/{total}). Không cần sửa.")
        return

    import random
    random.seed(0)
    random.shuffle(bgs)
    move = bgs[keep:]

    pool = os.path.join(DATASET_DIR, "backgrounds_pool")
    os.makedirs(os.path.join(pool, "images"), exist_ok=True)
    os.makedirs(os.path.join(pool, "labels"), exist_ok=True)

    print(f"[SỬA] Chuyển {len(move)} ảnh nền dư sang {pool} (giữ nguyên, không xóa).")
    moved = 0
    for img in move:
        lbl = label_path_for(img)
        try:
            os.replace(img, os.path.join(pool, "images", os.path.basename(img)))
            if os.path.exists(lbl):
                os.replace(lbl, os.path.join(pool, "labels", os.path.basename(lbl)))
            moved += 1
        except Exception as e:
            print(f"  Bỏ qua {os.path.basename(img)}: {e}")

    # Xóa cache để YOLO quét lại
    for c in glob.glob(os.path.join(DATASET_DIR, "*", "labels.cache")):
        try:
            os.remove(c)
        except Exception:
            pass

    print(f"[XONG] Đã chuyển {moved} ảnh. Tỉ lệ nền mới ~{target_ratio*100:.0f}%.")
    print("       Đã xóa labels.cache để YOLO nạp lại dataset.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Kiểm định chất lượng dataset")
    ap.add_argument("--fix", action="store_true",
                    help="Tự động cân bằng lại tỉ lệ ảnh nền (chuyển file, không xóa)")
    ap.add_argument("--bg-ratio", type=float, default=0.18,
                    help="Tỉ lệ ảnh nền mục tiêu khi dùng --fix (mặc định 0.18)")
    a = ap.parse_args()

    audit()
    if a.fix:
        print()
        fix_background_ratio(a.bg_ratio)
        print("\nChạy lại kiểm định để xác nhận:")
        print("  python src/01_data_prep/audit_dataset.py")
