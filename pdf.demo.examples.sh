#!/bin/bash

# Test custom PDF dimensions against localhost:3000
# Tests the fix for: Puppeteer ignores width/height when format is set

BASE_URL="http://localhost:3000/render"
OUTPUT_DIR="pdf-demo-examples"

mkdir -p "$OUTPUT_DIR"

echo "=========================================="
echo "PDF Custom Dimensions Test Suite"
echo "=========================================="
echo ""

# Test 1: Custom dimensions in mm
echo "Test 1: Custom dimensions in mm (210mm x 400mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"210mm","height":"400mm","margin":{"top":"10mm","bottom":"10mm","left":"10mm","right":"10mm"},"printBackground":true}}' \
  --output "$OUTPUT_DIR/01-custom-mm.pdf"
echo " -> $OUTPUT_DIR/01-custom-mm.pdf"

# Test 2: Custom dimensions in inches
echo "Test 2: US Letter size in inches (8.5in x 11in)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"8.5in","height":"11in","margin":{"top":"0.5in","bottom":"0.5in","left":"0.5in","right":"0.5in"}}}' \
  --output "$OUTPUT_DIR/02-letter-inches.pdf"
echo " -> $OUTPUT_DIR/02-letter-inches.pdf"

# Test 3: Custom dimensions in cm
echo "Test 3: Custom dimensions in cm (15cm x 25cm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"15cm","height":"25cm","margin":{"top":"1cm","bottom":"1cm","left":"1cm","right":"1cm"}}}' \
  --output "$OUTPUT_DIR/03-custom-cm.pdf"
echo " -> $OUTPUT_DIR/03-custom-cm.pdf"

# Test 4: Custom dimensions in px
echo "Test 4: Custom dimensions in px (600px x 800px)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"600px","height":"800px","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/04-custom-px.pdf"
echo " -> $OUTPUT_DIR/04-custom-px.pdf"

# Test 5: Square PDF
echo "Test 5: Square PDF (200mm x 200mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"200mm","height":"200mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/05-square.pdf"
echo " -> $OUTPUT_DIR/05-square.pdf"

# Test 6: Tall narrow PDF
echo "Test 6: Tall narrow PDF (100mm x 400mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"100mm","height":"400mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/06-tall-narrow.pdf"
echo " -> $OUTPUT_DIR/06-tall-narrow.pdf"

# Test 7: Wide short PDF (landscape-like custom)
echo "Test 7: Wide short PDF (400mm x 150mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"400mm","height":"150mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/07-wide-short.pdf"
echo " -> $OUTPUT_DIR/07-wide-short.pdf"

# Test 8: Small PDF (business card size)
echo "Test 8: Business card size (85mm x 55mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"85mm","height":"55mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/08-business-card.pdf"
echo " -> $OUTPUT_DIR/08-business-card.pdf"

# Test 9: Large poster size
echo "Test 9: Large poster (500mm x 700mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"500mm","height":"700mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/09-poster.pdf"
echo " -> $OUTPUT_DIR/09-poster.pdf"

# Test 10: Only width specified
echo "Test 10: Only width specified (300mm width)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"300mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/10-width-only.pdf"
echo " -> $OUTPUT_DIR/10-width-only.pdf"

# Test 11: Only height specified
echo "Test 11: Only height specified (500mm height)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"height":"500mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/11-height-only.pdf"
echo " -> $OUTPUT_DIR/11-height-only.pdf"

# Test 12: With HTML content - gradient background
echo "Test 12: HTML content with gradient (150mm x 300mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"html":"<html><body style=\"background:linear-gradient(to bottom,#ff6b6b,#4ecdc4);height:100vh;display:flex;align-items:center;justify-content:center\"><h1 style=\"color:white;font-size:48px\">Custom Size</h1></body></html>","type":"pdf","pdf":{"width":"150mm","height":"300mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"},"printBackground":true}}' \
  --output "$OUTPUT_DIR/12-html-gradient.pdf"
echo " -> $OUTPUT_DIR/12-html-gradient.pdf"

# Test 13: With HTML content - table
echo "Test 13: HTML table content (250mm x 150mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"html":"<html><body><table border=\"1\" style=\"width:100%;border-collapse:collapse\"><tr><th>Name</th><th>Value</th></tr><tr><td>Width</td><td>250mm</td></tr><tr><td>Height</td><td>150mm</td></tr></table></body></html>","type":"pdf","pdf":{"width":"250mm","height":"150mm","margin":{"top":"10mm","bottom":"10mm","left":"10mm","right":"10mm"}}}' \
  --output "$OUTPUT_DIR/13-html-table.pdf"
echo " -> $OUTPUT_DIR/13-html-table.pdf"

# Test 14: Landscape with custom dimensions
echo "Test 14: Landscape mode with custom (297mm x 210mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"297mm","height":"210mm","landscape":true,"margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/14-landscape-custom.pdf"
echo " -> $OUTPUT_DIR/14-landscape-custom.pdf"

# Test 15: Mixed units (should still work)
echo "Test 15: Width in inches, height in mm (5in x 200mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"5in","height":"200mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/15-mixed-units.pdf"
echo " -> $OUTPUT_DIR/15-mixed-units.pdf"

# Test 16: Receipt/ticket size
echo "Test 16: Receipt/ticket size (80mm x 200mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"html":"<html><body style=\"font-family:monospace;padding:10px\"><h2>RECEIPT</h2><hr><p>Item 1.....$10.00</p><p>Item 2.....$15.00</p><hr><p><strong>Total: $25.00</strong></p></body></html>","type":"pdf","pdf":{"width":"80mm","height":"200mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/16-receipt.pdf"
echo " -> $OUTPUT_DIR/16-receipt.pdf"

# Test 17: Photo print size (4x6 inches)
echo "Test 17: Photo print 4x6 inches"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"4in","height":"6in","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/17-photo-4x6.pdf"
echo " -> $OUTPUT_DIR/17-photo-4x6.pdf"

# Test 18: Legal size
echo "Test 18: Legal size (8.5in x 14in)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"8.5in","height":"14in","margin":{"top":"1in","bottom":"1in","left":"1in","right":"1in"}}}' \
  --output "$OUTPUT_DIR/18-legal.pdf"
echo " -> $OUTPUT_DIR/18-legal.pdf"

# Test 19: A5 size custom
echo "Test 19: A5 size (148mm x 210mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"148mm","height":"210mm","margin":{"top":"10mm","bottom":"10mm","left":"10mm","right":"10mm"}}}' \
  --output "$OUTPUT_DIR/19-a5-custom.pdf"
echo " -> $OUTPUT_DIR/19-a5-custom.pdf"

# Test 20: A3 size custom
echo "Test 20: A3 size (297mm x 420mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"297mm","height":"420mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/20-a3-custom.pdf"
echo " -> $OUTPUT_DIR/20-a3-custom.pdf"

# Test 21: Verify default A4 still works (no custom dimensions)
echo "Test 21: Default A4 format (no custom dimensions)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/21-default-a4.pdf"
echo " -> $OUTPUT_DIR/21-default-a4.pdf"

# Test 22: Device viewport + custom PDF size
echo "Test 22: Device viewport 800x600 + PDF 300mm x 200mm"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","device":{"width":800,"height":600},"pdf":{"width":"300mm","height":"200mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/22-viewport-custom-pdf.pdf"
echo " -> $OUTPUT_DIR/22-viewport-custom-pdf.pdf"

# Test 23: With scale option
echo "Test 23: Custom size with scale 0.8 (200mm x 280mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"200mm","height":"280mm","scale":0.8,"margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/23-with-scale.pdf"
echo " -> $OUTPUT_DIR/23-with-scale.pdf"

# Test 24: With header and footer
echo "Test 24: Custom size with header/footer (210mm x 297mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"210mm","height":"297mm","displayHeaderFooter":true,"headerTemplate":"<div style=\"font-size:10px;text-align:center;width:100%\">Header</div>","footerTemplate":"<div style=\"font-size:10px;text-align:center;width:100%\">Page <span class=\"pageNumber\"></span></div>","margin":{"top":"20mm","bottom":"20mm","left":"10mm","right":"10mm"}}}' \
  --output "$OUTPUT_DIR/24-header-footer.pdf"
echo " -> $OUTPUT_DIR/24-header-footer.pdf"

# Test 25: Decimal values
echo "Test 25: Decimal dimensions (123.5mm x 456.7mm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"123.5mm","height":"456.7mm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/25-decimal.pdf"
echo " -> $OUTPUT_DIR/25-decimal.pdf"

# Test 26: Tiny PDF (1cm x 1cm)
echo "Test 26: Tiny PDF (1cm x 1cm)"
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf","pdf":{"width":"1cm","height":"1cm","margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}' \
  --output "$OUTPUT_DIR/26-tiny-1cm.pdf"
echo " -> $OUTPUT_DIR/26-tiny-1cm.pdf"


echo ""
echo "=========================================="
echo "All tests completed!"
echo "=========================================="
echo ""
echo "Output files:"
ls -la "$OUTPUT_DIR"/*.pdf 2>/dev/null | awk '{print $5, $9}' | column -t
echo ""
echo "To verify PDF dimensions on macOS:"
echo "  mdls -name kMDItemPageHeight -name kMDItemPageWidth $OUTPUT_DIR/01-custom-mm.pdf"
echo ""
echo "Or with pdfinfo (if installed):"
echo "  pdfinfo $OUTPUT_DIR/01-custom-mm.pdf | grep 'Page size'"
