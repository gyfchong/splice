# Accessibility Improvements to File Upload

This document summarizes the WCAG and ARIA accessibility improvements made to the file upload feature on the homepage.

## Changes Made

### 1. **Proper ARIA Labels and Descriptions**
- Added `aria-label` to the drag-drop zone with clear instructions: "File upload area. Press Enter or Space to select files, or drag and drop files here."
- Added `aria-describedby="upload-instructions"` linking to helper text
- Added `aria-describedby` to the file input element

### 2. **Keyboard Accessibility**
- Implemented `handleKeyDown` handler that triggers file selection on Enter or Space key
- Added `tabIndex={isUploading ? -1 : 0}` to make drag-drop zone keyboard accessible
- Added focus ring styling: `focus:outline-none focus:ring-2 focus:ring-cyan-500`
- Disabled keyboard access during upload with `tabIndex={-1}`

### 3. **ARIA Live Regions for Status Updates**
- Added `role="status"` and `aria-live="polite"` to upload progress banner
- Added `role="status"` and `aria-live="polite"` to upload status messages
- Added `role="status"` and `aria-live="polite"` to categorization status messages
- Added `aria-atomic="true"` to ensure complete message is announced

### 4. **Clear Instructions and File Requirements**
- Added visible helper text: "Accepted formats: PDF, CSV. Max file size: 10MB per file."
- Linked instructions to input with `aria-describedby`
- Made Upload icon decorative with `aria-hidden="true"`

### 5. **ARIA Busy State**
- Added `aria-busy={isUploading}` to drag-drop zone during upload
- Added `aria-disabled={isUploading}` to the "Choose Files" label

### 6. **Visual Focus Indicators**
- Added Tailwind focus ring: `focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900`
- Ensures keyboard users can see what element has focus

## WCAG 2.1 Compliance

These changes ensure compliance with:

- **1.1.1 - Non-text Content**: Icons marked with `aria-hidden="true"`
- **1.3.1 - Info and Relationships**: Proper `<label>` and `aria-describedby` relationships
- **2.1.1 - Keyboard**: Full keyboard navigation with Enter/Space support
- **3.3.2 - Labels or Instructions**: Clear labels and helper text
- **4.1.3 - Status Messages**: ARIA live regions announce status changes

## Testing Recommendations

Test with:
1. **Keyboard Navigation**: Tab to the upload area, press Enter/Space to select files
2. **Screen Readers**: JAWS, NVDA (Windows), VoiceOver (Mac/iOS)
3. **Automated Tools**: Axe DevTools, Google Lighthouse

## References

Based on best practices from:
- [HTML File Upload Accessibility with WCAG and ARIA Best Practices](https://www.filestack.com/blog/accessibility/html-file-upload-accessibility-with-wcag-and-aria-best-practices/)
- WCAG 2.1 Guidelines
- WAI-ARIA 1.2 Specification
