import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ImagePreviewPayload } from "@/utils/imagePreviewEvent";
import {
  clampImagePreviewZoom,
  imagePreviewZoomPercent,
  stepImagePreviewZoom,
} from "@/utils/imagePreviewZoom";
import { useI18n } from "@/i18n/react";

export default function ImagePreviewWindow() {
  const { t } = useI18n();
  const [image, setImage] = useState<ImagePreviewPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    status: "idle" | "copying" | "copied" | "failed";
  } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const setPreviewImage = useCallback(
    (payload: ImagePreviewPayload) => {
      setImage(payload);
      setFailed(false);
      closeContextMenu();
      resetView();
    },
    [closeContextMenu, resetView],
  );

  const zoomBy = useCallback((direction: 1 | -1) => {
    setZoom((current) => stepImagePreviewZoom(current, direction));
  }, []);

  useEffect(() => {
    let cancelled = false;

    invoke<ImagePreviewPayload>("get_image_preview_content")
      .then((payload) => {
        if (!cancelled) {
          setPreviewImage(payload);
        }
      })
      .catch(() => {});

    const unlisten = listen<ImagePreviewPayload>(
      "image-preview-updated",
      (event) => {
        setPreviewImage(event.payload);
      },
    );

    return () => {
      cancelled = true;
      unlisten.then((dispose) => dispose());
    };
  }, [setPreviewImage]);

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (contextMenu) {
          closeContextMenu();
        } else {
          await getCurrentWindow().close();
        }
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomBy(1);
      } else if (event.key === "-") {
        event.preventDefault();
        zoomBy(-1);
      } else if (event.key === "0") {
        event.preventDefault();
        resetView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeContextMenu, contextMenu, resetView, zoomBy]);

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        (event.target as HTMLElement | null)?.closest(
          ".image-preview-context-menu",
        )
      ) {
        return;
      }
      closeContextMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [closeContextMenu, contextMenu]);

  const openContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (!image || failed) return;
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        status: "idle",
      });
    },
    [failed, image],
  );

  const copyPreviewImage = useCallback(async () => {
    if (!image || contextMenu?.status === "copying") return;

    setContextMenu((current) =>
      current ? { ...current, status: "copying" } : current,
    );

    try {
      await invoke("copy_preview_image_to_clipboard", { src: image.src });
      setContextMenu((current) =>
        current ? { ...current, status: "copied" } : current,
      );
      window.setTimeout(() => {
        setContextMenu(null);
      }, 600);
    } catch (error) {
      console.error("Failed to copy preview image:", error);
      setContextMenu((current) =>
        current ? { ...current, status: "failed" } : current,
      );
    }
  }, [contextMenu?.status, image]);

  const copyLabel =
    contextMenu?.status === "copying"
      ? t("common.loading")
      : contextMenu?.status === "copied"
        ? t("imagePreview.copiedImage")
        : contextMenu?.status === "failed"
          ? t("imagePreview.copyImageFailed")
          : t("imagePreview.copyImage");

  return (
    <div className="h-screen w-screen bg-bg text-ink rounded-[14px] overflow-hidden flex flex-col border border-line shadow-2xl">
      <div
        data-tauri-drag-region
        onMouseDown={async (event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          await getCurrentWindow().startDragging();
        }}
        className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-line bg-surface/95"
      >
        <div className="min-w-0 text-xs font-semibold text-stone truncate">
          {image?.alt || t("imagePreview.title")}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            title={t("imagePreview.zoomOut")}
            aria-label={t("imagePreview.zoomOut")}
            onClick={() => zoomBy(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-stone hover:text-ink hover:bg-line/70 transition-colors text-base leading-none"
          >
            -
          </button>
          <button
            type="button"
            title={t("imagePreview.resetZoom")}
            aria-label={t("imagePreview.resetZoom")}
            onClick={resetView}
            className="min-w-12 h-7 px-2 flex items-center justify-center rounded-md text-stone hover:text-ink hover:bg-line/70 transition-colors text-[11px] tabular-nums"
          >
            {imagePreviewZoomPercent(zoom)}
          </button>
          <button
            type="button"
            title={t("imagePreview.zoomIn")}
            aria-label={t("imagePreview.zoomIn")}
            onClick={() => zoomBy(1)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-stone hover:text-ink hover:bg-line/70 transition-colors text-base leading-none"
          >
            +
          </button>
          <button
            type="button"
            title={t("common.close")}
            aria-label={t("common.close")}
            onClick={async () => await getCurrentWindow().close()}
            className="w-7 h-7 flex items-center justify-center rounded-md text-stone hover:text-ink hover:bg-line/70 transition-colors text-base leading-none"
          >
            x
          </button>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 bg-black/90 flex items-center justify-center p-3 overflow-hidden touch-none"
        onWheel={(event) => {
          if (!image || failed) return;
          event.preventDefault();
          setZoom((current) =>
            stepImagePreviewZoom(current, event.deltaY < 0 ? 1 : -1),
          );
        }}
        onPointerDown={(event) => {
          if (!image || failed || zoom <= 1) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            panX: pan.x,
            panY: pan.y,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          setPan({
            x: drag.panX + event.clientX - drag.startX,
            y: drag.panY + event.clientY - drag.startY,
          });
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
          }
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onDoubleClick={resetView}
        onContextMenu={openContextMenu}
      >
        {image && !failed ? (
          <img
            key={image.src}
            src={image.src}
            alt={image.alt}
            className={`max-w-full max-h-full object-contain select-none ${
              zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""
            }`}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${clampImagePreviewZoom(zoom)})`,
              transition: dragRef.current ? "none" : "transform 120ms ease",
            }}
            draggable={false}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="text-sm text-stone text-center px-6">
            {failed ? t("imagePreview.loadFailed") : t("imagePreview.empty")}
          </div>
        )}
      </div>

      {contextMenu && image && !failed && (
        <div
          className="image-preview-context-menu fixed z-50 min-w-36 rounded-md border border-line bg-surface shadow-xl p-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={copyPreviewImage}
            disabled={contextMenu.status === "copying"}
            className="w-full h-8 px-3 flex items-center text-left rounded text-xs font-medium text-ink hover:bg-line/70 disabled:opacity-60 disabled:cursor-default transition-colors"
          >
            {copyLabel}
          </button>
        </div>
      )}
    </div>
  );
}
