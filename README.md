# Timelapse Aligner

A powerful web-based tool to align series of photos for perfectly smooth timelapses and collages. 

**Live Demo:** [https://sphaerox.github.io/PhotoTimelimeCollage/](https://sphaerox.github.io/PhotoTimelimeCollage/)

## 📸 What is Timelapse Aligner?
Have you ever taken a series of photos of the same subject over time (like a growing plant, a construction site, or a selfie-a-day project) but struggled because they weren't perfectly framed?

**Timelapse Aligner** allows you to:
1. Upload your photos.
2. Choose one as a reference ("Fix").
3. Align all other photos to match that reference perfectly using manual or automatic tools.
4. Export the result as a high-quality GIF or a wide collage.

## ✨ Features
- **Auto-Align:** Let the AI-driven matching algorithm find the best position for your images.
- **Manual Precision:** Use drag, rotate, and pinch-to-zoom (on mobile) or scroll wheel (on desktop) to fine-tune alignment.
- **Edge Detection Overlay:** Toggle a special "outline" mode to see exactly how features line up between images.
- **Camera Capture:** Take new photos directly in the app with a transparent overlay of your reference image.
- **GIF Export:** Customize hold time, fade transitions, and "Deflicker" (brightness normalization) for professional results.
- **Privacy First:** All processing happens locally in your browser. No images are uploaded to any server.

## 🚀 How to Use
1. **Upload Images:** Click "Upload Images" or use the Camera icon.
2. **Set Reference:** Find the image you want as your base and click the **"Fix"** button.
3. **Align Images:** Select another image by clicking **"Edit"**.
   - **Manually:** Drag the image, use the sliders for rotation/scale, or use the **"Auto-Align"** button.
   - **Apply to All:** Once you have a good crop/scale, you can "Apply to All" to use those settings for every image.
4. **Export:** Choose between "Save Collage" (JPEG) or "Save GIF" in the side panel.

## 🛠 Local Development
If you want to run this project locally:

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173` in your browser.

---
Built with React 19, Vite, and Tailwind CSS.
