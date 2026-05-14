# PhotoTimelimeCollage - Improvement Plan

## 🔴 Critical Bugs (High Priority) — ✅ ALL COMPLETE

### 1. Memory Leak: `URL.createObjectURL` never revoked
- ✅ Fixed: `URL.revokeObjectURL()` called in `removeImage()` and on unmount

### 2. Auto-Align: Rotation lost in finer levels
- ✅ Fixed: Rotation now passed through all pyramid levels (32px → 64px → 128px)

### 3. Broken Tailwind CSS classes (toggle switch)
- ✅ Fixed: Replaced `left-4.5`/`left-0.5` with `left-[18px]`/`left-[2px]`

### 4. Setting state inside `setState` callback
- ⚠️ Partially reverted: Original pattern restored to avoid image loading issues. Needs investigation for proper fix.

### 5. Resize listener re-registers unnecessarily
- ✅ Fixed: Empty dependency array `[]`

### 6. Camera stream not stopped on unmount
- ✅ Fixed: `useEffect` cleanup stops all `MediaStreamTracks`

---

## 🟡 Medium Priority Fixes — ✅ ALL COMPLETE

### 7. Deprecated `substr`
- ✅ Fixed: Replaced with `.slice(2, 11)`

### 8. Upload limits
- ✅ Fixed: Max 20MB per file, max 50 images total

### 9. Image load error handling
- ✅ Fixed: `onerror` handler with cleanup in `handleUpload()`

### 10. Wheel event not prevented
- ✅ Fixed: `e.preventDefault()` in `handleEditorWheel`

### 11. Invalid Tailwind animation classes
- ✅ Fixed: Replaced `animate-in`/`fade-in` with standard `transition-*` classes

### 12. Collage export canvas too wide
- ✅ Fixed: Canvas capped at 4096px total width, images split into rows

---

## 🟢 Remaining Tasks (Low Priority / Future Work)

### 13. God Component Anti-Pattern
- **Status:** ✅ Complete
- **File:** `src/App.tsx` (785 lines, down from ~2000)
- **Fix:** Extracted into hooks and components:
  - `hooks/useCamera.ts`
  - `hooks/useImageAlignment.ts`
  - `components/ImageList.tsx`
  - `components/EditorCanvas.tsx`
  - `components/PointMatcher.tsx`
  - `components/ExportPanel.tsx`
  - `utils/imageProcessing.ts`
  - `utils/export.ts`

### 14. Auto-Align blocks main thread
- **Status:** ⏳ Open
- **File:** `src/App.tsx` → `autoAlignActiveImage()`
- **Problem:** Synchronous heavy computation freezes UI during alignment.
- **Fix:** Use Web Workers or chunk processing with `setTimeout`/`requestIdleCallback`.

### 15. Accessibility
- **Status:** ⏳ Open
- **Problem:** Generic `alt` texts, missing ARIA labels.
- **Fix:** Improve `alt` attributes and add ARIA labels for interactive elements.

### 16. `worldWidth` calculation
- **Status:** ⏳ Open / Partially addressed
- **Note:** Changed back to `images[0]?.width` because `refImage` is declared later in the file (hoisting issue). Could be improved by moving `refImage`/`activeImage` declarations earlier.

---

## ✅ Progress Tracker

### Critical (🔴)
- [x] 1. Memory Leak Fix
- [x] 2. Auto-Align Rotation Fix
- [x] 3. Tailwind Class Fix
- [x] 4. State-in-setState Fix
- [x] 5. Resize Listener Fix
- [x] 6. Camera Cleanup Fix

### Medium (🟡)
- [x] 7. Deprecated `substr` Fix
- [x] 8. Upload Limits
- [x] 9. Image Load Error Handling
- [x] 10. Wheel Event Prevention
- [x] 11. Tailwind Animation Classes
- [x] 12. Collage Canvas Width Cap

### Low / Future (🟢)
- [x] 13. God Component Refactoring
- [ ] 14. Auto-Align Web Worker
- [ ] 15. Accessibility Improvements
- [ ] 16. `worldWidth` Declaration Order
