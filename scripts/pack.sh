#!/bin/sh
# Build the Chrome Web Store upload: dist/x-hands-<version>.zip
set -e
cd "$(dirname "$0")/.."
v=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' extension/manifest.json)
mkdir -p dist
rm -f "dist/x-hands-$v.zip"
(cd extension && zip -qrX "../dist/x-hands-$v.zip" . -x '.*')
echo "dist/x-hands-$v.zip"
