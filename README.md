## Paper website (GitHub Pages)

This repository contains a **static** project page for the paper:
**“Visually Prompted Benchmarks Are Surprisingly Fragile.”**

The site is intentionally minimal and easy to edit: update text in `index.html`, drop media into `assets/`, and publish with GitHub Pages.

## Repo structure (code + inputs/outputs)

- **`index.html` (input)**: page content (title, authors, abstract, sections, links, citation)
  - **Outputs**: the rendered web page in the browser.
- **`styles.css` (input)**: styling (Avenir-first font stack, palette, layout, responsiveness)
  - **Outputs**: visual presentation of the page.
- **`script.js` (input)**: small UI helper (copy BibTeX button)
  - **Outputs**: copies the BibTeX text to the clipboard (when supported).
- **`assets/` (inputs)**: media you add (figures/animations/favicon)
  - **Outputs**: displayed images/videos/icons on the page.

## What to edit first

In `index.html`:
- **Title**: `<title>` and the `<h1>` in the hero.
- **Authors / affiliations**: replace placeholders under the title.
- **Links**: update the “Paper / arXiv / Code / Data” buttons.
- **Abstract**: paste your final abstract text.
- **Figures & animations**: replace placeholder cards with your real images/videos.
- **Citation & BibTeX**: update to the final venue and author list.

## Adding figures

Put images into:
- `assets/figures/`

Then reference them in `index.html`, e.g.

```html
<img src="assets/figures/figure1.png" alt="Figure 1: ..." />
```

## Adding animations (yes, GitHub Pages supports them)

GitHub Pages supports standard web media formats. Put files into:
- `assets/animations/`

Use HTML5 video (recommended for smooth looping):

```html
<video autoplay muted loop playsinline controls>
  <source src="assets/animations/teaser.webm" type="video/webm" />
  <source src="assets/animations/teaser.mp4" type="video/mp4" />
</video>
```

## Font note (Avenir)

This site uses an **Avenir-first** CSS font stack:
`"Avenir Next", Avenir, system-ui, ...`

If you need **guaranteed Avenir everywhere**, you’ll need to **self-host** the font files via `@font-face` (subject to your font license) and point the CSS to your hosted font files.


