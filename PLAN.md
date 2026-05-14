# PhotoTimelimeCollage - Improvement Plan

## 🔴 Critical Bugs (High Priority - Fix First)

### 1. Memory Leak: `URL.createObjectURL` never revoked
- **File:** `src/App.tsx`
- **Problem:** `URL.createObjectURL(file)` creates blob URLs but `URL.revokeObjectURL(url)` is never called. Leaks memory when images are removed or on unmount.
- **Fix:**
  - Call `URL.revokeObjectURL(img.url)` in `removeImage()`.
  - Add a `useEffect` cleanup that revokes all remaining URLs when component unmounts.

### 2. Auto-Align: Rotation lost in finer levels
- **File:** `src/App.tsx` → `autoAlignActiveImage()`
- **Problem:** `searchRotation = true` only on the first level (32px). `c.rot` is computed but never passed to the 64px and 128px levels.
- **Fix:** Pass the rotation result (`c.rot`, then `m.rot`) into subsequent `alignOnScale()` calls and apply it inside the `draw()` function.

### 3. Broken Tailwind CSS classes (toggle switch)
- **File:** `src/App.tsx`
- **Problem:** `left-4.5` and `left-0.5` are not valid Tailwind utilities. The toggle switch in Point-Match mode is visually broken.
- **Fix:** Replace with valid utilities or arbitrary values, e.g. `left-[18px]` / `left-[2px]`.

### 4. Setting state inside `setState` callback
- **File:** `src/App.tsx` → `handleUpload()` & `capturePhoto()`
- **Problem:** `setRefId()` and `setActiveId()` are called inside the `setImages(prev => ...)` updater. This is a React anti-pattern and can cause stale/batched state issues.
- **Fix:** Move the id-setting logic outside the updater (e.g. into `useEffect` or simply after `setImages`).

### 5. Resize listener re-registers unnecessarily
- **File:** `src/App.tsx`
- **Problem:** The resize `useEffect` depends on `[activeId, refId]`, causing remove/add of the listener on every selection change.
- **Fix:** Use an empty dependency array `[]`.

### 6. Camera stream not stopped on unmount
- **File:** `src/App.tsx`
- **Problem:** If the user leaves the page while the camera is active, `MediaStream` tracks keep running.
- **Fix:** Add a `useEffect` cleanup that stops tracks when `isCameraActive` changes or on unmount.

---

## 🟡 Important Architecture & Logic Issues (Medium Priority)

### 7. God Component Anti-Pattern
- **File:** `src/App.tsx` (~2000 lines)
- **Problem:** Everything lives in one component.
- **Fix:** Extract into hooks and components:
  - `hooks/useCamera.ts`
  - `hooks/useImageAlignment.ts`
  - `components/ImageList.tsx`
  - `components/EditorCanvas.tsx`
  - `components/PointMatcher.tsx`
  - `components/ExportPanel.tsx`
  - `utils/imageProcessing.ts`
  - `utils/export.ts`

### 8. Collage export canvas too wide
- **File:** `src/App.tsx` → `generateCollage()`
- **Problem:** `canvas.width = outWidth * images.length` can exceed browser limits (e.g. 20 images × 1280px = 25,600px).
- **Fix:** Cap max width or split into multiple rows.

### 9. Missing image load error handling
- **File:** `src/App.tsx`
- **Problem:** `loadImg` only waits for `onload`, not `onerror`.
- **Fix:** Reject promise on `onerror`.

### 10. Auto-Align blocks main thread
- **File:** `src/App.tsx`
- **Problem:** Synchronous heavy computation freezes UI.
- **Fix:** Use Web Workers or chunk processing with `setTimeout`/`requestIdleCallback`.

---

## 🟢 Further Improvements & Code Quality (Low Priority)

### 11. `substr` is deprecated
- **Fix:** Replace `.substr(2, 9)` with `.slice(2, 11)`.

### 12. `worldWidth` calculation is fragile
- **Fix:** Use `refImage?.width` instead of `images[0]?.width`.

### 13. Wheel event not prevented
- **Fix:** Call `e.preventDefault()` in `handleEditorWheel`.

### 14. No upload limits
- **Fix:** Add max file size and max image count validation.

### 15. Accessibility
- **Fix:** Improve `alt` texts and add ARIA labels where missing.

### 16. Missing Tailwind animation plugin
- **Fix:** Either install `tailwindcss-animate` or remove `animate-in`/`fade-in` classes.

---

## ✅ Progress Tracker

- [ ] 1. Memory Leak Fix
- [ ] 2. Auto-Align Rotation Fix
- [ ] 3. Tailwind Class Fix
- [ ] 4. State-in-setState Fix
- [ ] 5. Resize Listener Fix
- [ ] 6. Camera Cleanup Fix
