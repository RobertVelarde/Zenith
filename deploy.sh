# Build & deploy script for GitHub Pages.
# Run from the suncalc/ directory:
#   ./deploy.sh
#
# The built files are placed into ../suncalc-dist/ and then
# copied to the parent repo so they're served at /suncalc/.
set -e

echo "▸ Building…"
npm run build

echo "▸ Copying dist to parent repo /suncalc-dist/ folder…"
DEST="../suncalc-dist"
rm -rf "$DEST"
cp -r dist "$DEST"

# Copy 404.html so GitHub Pages handles SPA routes
cp dist/index.html "$DEST/404.html"

echo "✓ Done. Files are in $DEST"
echo "  Move the contents to your repo root under /suncalc/ and commit."
