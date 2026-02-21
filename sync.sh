#!/bin/bash

# Ensure we're in the project root
cd "$(dirname "$0")"

echo "🔄 Synchronizing Rust types to Next.js TypeScript definitions..."

# Verify typeshare is installed
if ! command -v typeshare &> /dev/null; then
    echo "⚙️  typeshare-cli not found. Installing..."
    cargo install typeshare-cli
fi

# Run typeshare against the Rust API directory
# We output the generated TypeScript interfaces into the Next.js types directory
echo "📝 Generating TypeScript interfaces..."
typeshare ./memora-api/src --lang=typescript --output-file=./memora-web/src/types/api.ts

if [ $? -eq 0 ]; then
    echo "✅ Type synchronization complete!"
    echo "📄 Types written to: memora-web/src/types/api.ts"
else
    echo "❌ Type synchronization failed."
    exit 1
fi
