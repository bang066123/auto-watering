"""
domain_augment.py - Thu hẹp khoảng cách domain giữa ảnh huấn luyện và video CCTV
Đề tài: Hệ Thống Trinh Sát Phát Hiện Hung Khí - PTIT

VẤN ĐỀ CỐT LÕI (Domain Gap)
---------------------------
Dataset Sohas/OD-WeaponDetection gồm ảnh chụp CẬN CẢNH, nét, đủ sáng, vật thể
chiếm phần lớn khung hình. Trong khi đó video giám sát thực tế có đặc điểm
hoàn toàn khác:

    Ảnh huấn luyện              Video CCTV thực tế
    ------------------          ---------------------------
    Nét căng                    Mờ do chuyển động (motion blur)
    Đủ sáng                     Thiếu sáng, ngược sáng, ám màu đèn
    Không nén                   Nén H.264 mạnh, nhiễu khối
    Vật thể lớn, gần            Vật thể nhỏ, ở xa (20-60 pixel)
    Góc ngang tầm mắt           Góc cao từ trần nhà

Mô hình học trên domain A nhưng chạy trên domain B thì mAP trên tập test
có thể rất đẹp mà thực tế vẫn bỏ sót. Script này sinh thêm một tập dữ liệu
đã được "làm xấu" có kiểm soát, mô phỏng đúng điều kiện CCTV, dùng cho
GIAI ĐOẠN B (finetune).

ĐIỂM QUAN TRỌNG: mọi phép biến đổi ở đây KHÔNG làm thay đổi tọa độ bounding
box (chỉ đổi pixel, không đổi hình học), nên file nhãn được sao chép nguyên vẹn.
Riêng phép thu nhỏ vật thể dùng padding giữ tỉ lệ nên nhãn ĐƯỢC TÍNH LẠI.

CÁCH DÙNG
---------
    python src/01_data_prep/domain_augment.py
    python src/01_data_prep/domain_augment.py --variants 2 --include-original
"""

import os
import sys
import glob
import random
import shutil
import argparse

import cv2
import numpy as np
from tqdm import tqdm

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
SRC_DATASET = os.path.join(PROJECT_ROOT, "data", "dataset")
DST_DATASET = os.path.join(PROJECT_ROOT, "data", "dataset_domain")
IMG_EXT = (".jpg", ".jpeg", ".png", ".bmp")


# ===========================================================================
# CÁC BỘ LỌC MÔ PHỎNG CAMERA GIÁM SÁT (không đổi tọa độ bounding box)
# ===========================================================================
def motion_blur(img, size=None, angle=None):
    """Mờ chuyển động: mô phỏng người/hung khí di chuyển nhanh trước camera."""
    h, w = img.shape[:2]
    size = size or random.choice([5, 7, 9, 11])
    angle = angle if angle is not None else random.uniform(0, 180)

    kernel = np.zeros((size, size), dtype=np.float32)
    kernel[size // 2, :] = 1.0
    M = cv2.getRotationMatrix2D((size / 2 - 0.5, size / 2 - 0.5), angle, 1.0)
    kernel = cv2.warpAffine(kernel, M, (size, size))
    s = kernel.sum()
    if s > 0:
        kernel /= s
    return cv2.filter2D(img, -1, kernel)


def low_light(img, gamma=None, noise_sigma=None):
    """Thiếu sáng + nhiễu hạt: mô phỏng camera ban đêm / hành lang tối."""
    gamma = gamma or random.uniform(1.6, 2.6)
    inv = 1.0 / gamma
    table = np.array([((i / 255.0) ** inv) * 255 for i in range(256)]).astype(np.uint8)
    out = cv2.LUT(img, table)

    sigma = noise_sigma or random.uniform(6, 16)
    noise = np.random.normal(0, sigma, out.shape).astype(np.float32)
    out = np.clip(out.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    return out


def jpeg_compress(img, quality=None):
    """Nén mạnh: mô phỏng luồng video bị nén H.264/MJPEG chất lượng thấp."""
    quality = quality or random.randint(18, 42)
    ok, enc = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return img
    return cv2.imdecode(enc, cv2.IMREAD_COLOR)


def resolution_drop(img, factor=None):
    """Giảm độ phân giải rồi phóng ngược: mô phỏng camera độ phân giải thấp."""
    factor = factor or random.uniform(0.25, 0.5)
    h, w = img.shape[:2]
    small = cv2.resize(img, (max(1, int(w * factor)), max(1, int(h * factor))),
                       interpolation=cv2.INTER_AREA)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)


def color_cast(img):
    """Ám màu: đèn huỳnh quang ngả xanh, đèn sodium ngả cam."""
    out = img.astype(np.float32)
    mode = random.choice(["cool", "warm", "green"])
    if mode == "cool":
        out[:, :, 0] *= random.uniform(1.05, 1.20)   # B
        out[:, :, 2] *= random.uniform(0.85, 0.95)   # R
    elif mode == "warm":
        out[:, :, 2] *= random.uniform(1.05, 1.20)
        out[:, :, 0] *= random.uniform(0.85, 0.95)
    else:
        out[:, :, 1] *= random.uniform(1.05, 1.15)   # G
    return np.clip(out, 0, 255).astype(np.uint8)


def backlight(img):
    """Ngược sáng: vùng cửa sổ/đèn cháy sáng, vật thể chìm vào bóng."""
    h, w = img.shape[:2]
    cx, cy = random.randint(0, w), random.randint(0, int(h * 0.4))
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    radius = max(h, w) * random.uniform(0.3, 0.6)
    glow = np.clip(1.0 - dist / radius, 0, 1) ** 2
    glow = (glow * random.uniform(80, 150))[:, :, None]
    return np.clip(img.astype(np.float32) + glow, 0, 255).astype(np.uint8)


# ===========================================================================
# PHÉP BIẾN ĐỔI CÓ ĐỔI HÌNH HỌC -> PHẢI TÍNH LẠI NHÃN
# ===========================================================================
def shrink_object(img, boxes, scale=None):
    """
    Thu nhỏ toàn bộ khung hình rồi chèn vào nền tối theo đúng kích thước gốc.
    Mô phỏng vật thể ở XA camera - điểm yếu lớn nhất của mô hình hiện tại.
    Bounding box được tính lại theo đúng phép biến đổi.
    """
    h, w = img.shape[:2]
    scale = scale or random.uniform(0.35, 0.6)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    small = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)

    # Nền là phiên bản mờ của chính ảnh gốc -> trông tự nhiên hơn nền đen
    canvas = cv2.GaussianBlur(cv2.resize(img, (w, h)), (51, 51), 0)
    canvas = (canvas.astype(np.float32) * 0.45).astype(np.uint8)

    ox = random.randint(0, w - nw)
    oy = random.randint(0, h - nh)
    canvas[oy:oy + nh, ox:ox + nw] = small

    new_boxes = []
    for cls, x, y, bw, bh in boxes:
        nx = (x * nw + ox) / w
        ny = (y * nh + oy) / h
        nbw = bw * nw / w
        nbh = bh * nh / h
        if nbw > 0.001 and nbh > 0.001:
            new_boxes.append((cls, nx, ny, nbw, nbh))
    return canvas, new_boxes


# ===========================================================================
PIXEL_FILTERS = [
    ("blur", motion_blur),
    ("dark", low_light),
    ("jpeg", jpeg_compress),
    ("lowres", resolution_drop),
    ("cast", color_cast),
    ("backlit", backlight),
]


def read_labels(path):
    boxes = []
    if not os.path.exists(path):
        return boxes
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            p = line.strip().split()
            if len(p) == 5:
                try:
                    boxes.append((int(float(p[0])), *(float(v) for v in p[1:])))
                except ValueError:
                    pass
    return boxes


def write_labels(path, boxes):
    with open(path, "w", encoding="utf-8") as f:
        for cls, x, y, w, h in boxes:
            f.write(f"{cls} {x:.6f} {y:.6f} {w:.6f} {h:.6f}\n")


def make_variant(img, boxes):
    """
    Tạo một biến thể bằng cách xếp chồng 1-3 bộ lọc.
    30% trường hợp áp dụng thêm phép thu nhỏ vật thể.
    """
    tags = []
    out, out_boxes = img.copy(), list(boxes)

    if random.random() < 0.30:
        out, out_boxes = shrink_object(out, out_boxes)
        tags.append("far")

    k = random.randint(1, 3)
    for name, fn in random.sample(PIXEL_FILTERS, k):
        out = fn(out)
        tags.append(name)

    return out, out_boxes, "-".join(tags)


def process_split(split, variants, include_original, limit=None):
    src_img_dir = os.path.join(SRC_DATASET, split, "images")
    src_lbl_dir = os.path.join(SRC_DATASET, split, "labels")
    dst_img_dir = os.path.join(DST_DATASET, split, "images")
    dst_lbl_dir = os.path.join(DST_DATASET, split, "labels")
    os.makedirs(dst_img_dir, exist_ok=True)
    os.makedirs(dst_lbl_dir, exist_ok=True)

    files = []
    for ext in IMG_EXT:
        files += glob.glob(os.path.join(src_img_dir, f"*{ext}"))
        files += glob.glob(os.path.join(src_img_dir, f"*{ext.upper()}"))
    files = sorted(set(files))
    if limit:
        random.shuffle(files)
        files = files[:limit]

    if not files:
        print(f"[{split}] Không có ảnh nguồn.")
        return 0

    # Tập val/test chỉ sinh 1 biến thể để đánh giá sát thực tế
    n_var = variants if split == "train" else 1

    count = 0
    for img_path in tqdm(files, desc=f"Domain-aug [{split}]"):
        base = os.path.splitext(os.path.basename(img_path))[0]
        lbl_path = os.path.join(src_lbl_dir, base + ".txt")
        boxes = read_labels(lbl_path)

        img = cv2.imread(img_path)
        if img is None:
            continue

        if include_original:
            cv2.imwrite(os.path.join(dst_img_dir, f"{base}.jpg"), img,
                        [int(cv2.IMWRITE_JPEG_QUALITY), 95])
            write_labels(os.path.join(dst_lbl_dir, f"{base}.txt"), boxes)
            count += 1

        for i in range(n_var):
            aug, aug_boxes, tag = make_variant(img, boxes)
            name = f"{base}_cctv{i}_{tag}"
            cv2.imwrite(os.path.join(dst_img_dir, f"{name}.jpg"), aug,
                        [int(cv2.IMWRITE_JPEG_QUALITY), 92])
            write_labels(os.path.join(dst_lbl_dir, f"{name}.txt"), aug_boxes)
            count += 1

    return count


def main():
    ap = argparse.ArgumentParser(
        description="Sinh tập dữ liệu mô phỏng điều kiện camera giám sát"
    )
    ap.add_argument("--variants", type=int, default=2,
                    help="Số biến thể CCTV sinh ra cho mỗi ảnh train (mặc định 2)")
    ap.add_argument("--include-original", action="store_true", default=True,
                    help="Giữ cả ảnh gốc trong tập finetune (khuyến nghị bật)")
    ap.add_argument("--no-original", dest="include_original", action="store_false")
    ap.add_argument("--limit", type=int, default=None,
                    help="Chỉ xử lý N ảnh đầu mỗi tập (để chạy thử nhanh)")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)

    if not os.path.isdir(SRC_DATASET):
        print(f"[LỖI] Không tìm thấy dataset nguồn: {SRC_DATASET}")
        return

    print("=" * 70)
    print("   SINH DỮ LIỆU MÔ PHỎNG CAMERA GIÁM SÁT (DOMAIN ADAPTATION)")
    print("   Học viện Công nghệ Bưu chính Viễn thông (PTIT)")
    print("=" * 70)
    print(f"Nguồn            : {SRC_DATASET}")
    print(f"Đích             : {DST_DATASET}")
    print(f"Biến thể mỗi ảnh : {args.variants} (tập train)")
    print(f"Giữ ảnh gốc      : {args.include_original}")
    print("Các hiệu ứng     : motion blur, thiếu sáng, nén JPEG, hạ độ phân giải,")
    print("                   ám màu, ngược sáng, thu nhỏ vật thể (mô phỏng ở xa)")
    print("=" * 70 + "\n")

    total = 0
    for split in ("train", "val", "test"):
        total += process_split(split, args.variants, args.include_original, args.limit)

    print("\n" + "=" * 70)
    print(f"[HOÀN TẤT] Đã sinh {total} ảnh vào {DST_DATASET}")
    print("=" * 70)
    print("\nBước tiếp theo:")
    print("  1. Kiểm tra configs/data_finetune.yaml trỏ đúng tới data/dataset_domain")
    print("  2. Chạy tinh chỉnh:  python src/02_training/train.py --stage finetune")
    print("\nGỢI Ý QUAN TRỌNG:")
    print("  Dữ liệu mô phỏng chỉ thu hẹp được một phần khoảng cách domain.")
    print("  Hiệu quả cao nhất vẫn là gán nhãn ~200-500 frame TỪ CHÍNH video giám sát")
    print("  của đề tài rồi trộn vào data/dataset_domain/train/. Chỉ cần vài trăm ảnh")
    print("  đúng domain đã thường cho mức tăng mAP lớn hơn mọi kỹ thuật mô phỏng.")


if __name__ == "__main__":
    main()
