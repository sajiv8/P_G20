# පද්ධතියේ පරීක්ෂණ අවස්ථා (Test Cases) පිළිබඳ පැහැදිලි කිරීම

මෙම `tests` ෆෝල්ඩරය තුළ අපගේ පද්ධතියේ ප්‍රධාන සේවා (microservices) 5 සහ පොදු ගොනු (shared) සඳහා සරල පරීක්ෂණ (Test cases) 54 ක් අඩංගු වේ. මෙම පරීක්ෂණ නිර්මාණය කර ඇත්තේ පද්ධතියේ මූලික තාර්කික ක්‍රියාවලීන් නිවැරදිව ක්‍රියාත්මක වේද යන්න තහවුරු කර ගැනීම සඳහාය.

## පරීක්ෂණ ගොනු (Test Files) 6ක් ඇත:

1. **`tenant-service.test.ts`** (පරීක්ෂණ 9) - ආයතන (Tenants) සම්බන්ධ මූලික පරීක්ෂණ (උදා: Tenant statuses, Domain format).
2. **`user-service.test.ts`** (පරීක්ෂණ 9) - පරිශීලක සේවාව (උදා: Roles, Email validation, Admin permissions).
3. **`resource-service.test.ts`** (පරීක්ෂණ 9) - සම්පත් සේවාව (උදා: Hall/Lab/Equipment categories, Capacity validation).
4. **`booking-service.test.ts`** (පරීක්ෂණ 9) - වෙන්කිරීමේ සේවාව (උදා: Booking statuses, Overlapping checks, Refunds).
5. **`notification-service.test.ts`** (පරීක්ෂණ 9) - දැනුම්දීම් සේවාව (උදා: Read/Unread count, Email/Push types).
6. **`shared.test.ts`** (පරීක්ෂණ 9) - පොදු කේත සඳහා (උදා: API Error structure, Pagination math).

---

## පරීක්ෂණ ධාවනය කරන ආකාරය (How to run tests)

පරීක්ෂණ ධාවනය කිරීම සඳහා පහත විධාන (commands) ඔබේ Terminal එකෙහි (උදා: VS Code Terminal) ලබා දෙන්න.

### 1. සියලුම පරීක්ෂණ 54 එකවර ධාවනය කිරීමට (Run all tests):
මෙමගින් පරීක්ෂණ ගොනු 6 ම ධාවනය වේ.
```bash
npx jest tests/
```

### 2. එක් සේවාවකට අදාළ පරීක්ෂණ පමණක් ධාවනය කිරීමට (Run a specific test file):
ඔබට අවශ්‍ය සේවාවට අදාළ ගොනුවේ නම පමණක් ලබා දෙන්න.

**උදාහරණයක් ලෙස වෙන්කිරීමේ සේවාව (Booking Service) පමණක් පරීක්ෂා කිරීමට:**
```bash
npx jest tests/unit/booking-service.test.ts
```
*(අනෙකුත් ගොනු සඳහාද මෙම ආකාරයටම `tenant-service.test.ts`, `user-service.test.ts` යනාදී වශයෙන් වෙනස් කර ලබා දෙන්න.)*

### 3. තනි පරීක්ෂණයක් (Single Test Case) පමණක් ධාවනය කිරීමට:
ගොනුවක් ඇතුළත ඇති එක් පරීක්ෂණයක් (උදා: `TC-BOOK-005`) පමණක් ධාවනය කිරීමට අවශ්‍ය නම් `-t` යොදාගන්න.
```bash
npx jest tests/unit/booking-service.test.ts -t "TC-BOOK-005"
```

---

**සටහන:** දැනට ඇති සියලුම පරීක්ෂණ 54 කිසිදු දෝෂයකින් තොරව සාර්ථකව (PASS) ක්‍රියාත්මක වීමට සකසා ඇත. අනාගතයේදී ඔබට අවශ්‍ය නම් මෙම ගොනු තුළට තවත් අලුත් පරීක්ෂණ එකතු කළ හැකිය.
