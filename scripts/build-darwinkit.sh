#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DARWINKIT_DIR="${ROOT_DIR}/src-tauri/darwinkit"
BIN_DIR="${ROOT_DIR}/src-tauri/binaries"

if [[ ! -f "${DARWINKIT_DIR}/Package.swift" ]]; then
  echo "DarwinKit submodule is missing."
  echo "Run: git submodule update --init --recursive"
  exit 1
fi

case "$(uname -m)" in
  arm64)
    SWIFT_ARCH="arm64"
    BUILD_ARCH_DIR="arm64-apple-macosx"
    TARGET_TRIPLE="aarch64-apple-darwin"
    ;;
  x86_64)
    SWIFT_ARCH="x86_64"
    BUILD_ARCH_DIR="x86_64-apple-macosx"
    TARGET_TRIPLE="x86_64-apple-darwin"
    ;;
  *)
    echo "Unsupported macOS architecture: $(uname -m)"
    exit 1
    ;;
esac

mkdir -p "${BIN_DIR}"

cd "${DARWINKIT_DIR}"
swift build -c release --arch "${SWIFT_ARCH}"
cp ".build/${BUILD_ARCH_DIR}/release/darwinkit" "${BIN_DIR}/darwinkit-${TARGET_TRIPLE}"
file "${BIN_DIR}/darwinkit-${TARGET_TRIPLE}"
