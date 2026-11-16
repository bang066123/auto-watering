// ===================================================================
// FILE: src/utils/timeRange.js
// CHỨC NĂNG: Phân tích mốc thời gian người dùng nhập theo ĐÚNG định dạng
// đang hiển thị ở cột "Thời Gian Ghi Nhận" (vi-VN trên trình duyệt):
//     HH:mm:ss dd/MM/yyyy      ví dụ: 21:30:00 19/10/2026
// và quy đổi thành khoảng [from, to] dạng ISO để gửi xuống Backend.
//
// Mức chính xác tự co giãn theo phần người dùng nhập:
//   19/10/2026               -> cả ngày       00:00:00 .. 23:59:59
//   21 19/10/2026            -> cả giờ 21     21:00:00 .. 21:59:59
//   21:30 19/10/2026         -> cả phút đó    21:30:00 .. 21:30:59
//   21:30:00 19/10/2026      -> đúng giây đó
// Vẫn chấp nhận thứ tự ngược (19/10/2026 21:30) và định dạng ISO
// (2026-10-19 21:30 hoặc 2026-10-19T21) để không phá các mốc đã dùng.
// ===================================================================

const pad = (n) => String(n).padStart(2, '0');

// Thông báo gợi ý dùng chung cho các ô nhập mốc thời gian
export const TIME_FORMAT_HINT =
  'Định dạng thời gian chưa đúng. Ví dụ: 21:30:00 19/10/2026, 21:30 19/10/2026 hoặc 19/10/2026';
export const TIME_FORMAT_PLACEHOLDER = 'VD: 21:30 19/10/2026';

export function parseVnTimeRange(raw) {
  if (!raw) return null;

  // [1] Chuẩn hóa: bỏ dấu phẩy, đổi 'T' của chuỗi ISO thành dấu cách, gộp khoảng trắng dư
  const text = String(raw)
    .trim()
    .replace(/,/g, ' ')
    .replace(/(\d)[Tt](\d)/, '$1 $2')
    .replace(/\s+/g, ' ');
  if (!text) return null;

  // [2] Tách phần ngày và phần giờ - chấp nhận cả hai thứ tự
  const tokens = text.split(' ');
  const isDateToken = (tk) => tk.includes('/') || tk.includes('-');

  let datePart = '';
  let timePart = '';
  if (isDateToken(tokens[0])) {
    datePart = tokens[0];
    timePart = tokens[1] || '';
  } else {
    timePart = tokens[0];
    datePart = tokens[1] || '';
  }
  if (!datePart) return null;

  // [3] Đọc ngày: ưu tiên dd/MM/yyyy (đúng thứ tự đang hiển thị trên bảng)
  let day, month, year;
  if (datePart.includes('/')) {
    const seg = datePart.split('/').filter((x) => x !== '');
    if (seg.length < 2) return null;
    day = Number(seg[0]);
    month = Number(seg[1]);
    if (seg[2] === undefined) {
      year = new Date().getFullYear();
    } else if (seg[2].length === 2) {
      year = 2000 + Number(seg[2]);
    } else {
      year = Number(seg[2]);
    }
  } else {
    const seg = datePart.split('-').filter((x) => x !== '');   // yyyy-MM-dd
    if (seg.length < 3) return null;
    year = Number(seg[0]);
    month = Number(seg[1]);
    day = Number(seg[2]);
  }

  if (!day || !month || !year) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // [4] Đọc giờ và xác định mức chính xác người dùng nhập tới đâu
  const seg = timePart ? timePart.split(':') : [];
  const hasHour = seg.length >= 1 && seg[0] !== '';
  const hasMinute = seg.length >= 2 && seg[1] !== '';
  const hasSecond = seg.length >= 3 && seg[2] !== '';

  const hour = hasHour ? Number(seg[0]) : 0;
  const minute = hasMinute ? Number(seg[1]) : 0;
  const second = hasSecond ? Number(seg[2]) : 0;

  if ([hour, minute, second].some((n) => Number.isNaN(n))) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  // [5] Dựng khoảng thời gian tương ứng
  const date = `${year}-${pad(month)}-${pad(day)}`;
  let fromTime, toTime;
  if (!hasHour) {
    fromTime = '00:00:00';
    toTime = '23:59:59';
  } else if (!hasMinute) {
    fromTime = `${pad(hour)}:00:00`;
    toTime = `${pad(hour)}:59:59`;
  } else if (!hasSecond) {
    fromTime = `${pad(hour)}:${pad(minute)}:00`;
    toTime = `${pad(hour)}:${pad(minute)}:59`;
  } else {
    fromTime = `${pad(hour)}:${pad(minute)}:${pad(second)}`;
    toTime = fromTime;
  }

  return { from: `${date}T${fromTime}`, to: `${date}T${toTime}` };
}
