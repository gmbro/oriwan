"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconSync, IconX } from "@/components/icons";

type GalleryPhoto = {
  id: string;
  name: string;
  path: string;
  url: string;
};

type GalleryGroup = {
  date: string;
  date_label: string;
  album_title: string;
  photos: GalleryPhoto[];
};

type GalleryPayload = {
  bucket?: string;
  generated_at?: string;
  total_count?: number;
  groups?: GalleryGroup[];
  setup_required?: boolean;
  error?: string;
};

type SelectedPhoto = {
  photo: GalleryPhoto;
  group: GalleryGroup;
  index: number;
};

function flattenGroups(groups: GalleryGroup[]) {
  return groups.flatMap((group) => group.photos.map((photo) => ({ photo, group })));
}

export function SnasaPhotoGallery() {
  const [groups, setGroups] = useState<GalleryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const flatPhotos = useMemo(() => flattenGroups(groups), [groups]);

  const selected = selectedIndex === null ? null : flatPhotos[selectedIndex];

  const loadPhotos = useCallback(async (refresh = false) => {
    setLoading(true);
    if (refresh) setMessage("");

    try {
      const response = await fetch(`/api/public-photos${refresh ? "?refresh=1" : ""}`, {
        cache: "no-store",
      });
      const json = await response.json() as GalleryPayload;
      if (!response.ok) throw new Error(json.error || "사진첩을 불러오지 못했어요.");

      setGroups(json.groups || []);
      if (json.setup_required) {
        setMessage(json.error || "사진첩 버킷을 준비하면 사진이 여기에 보여요.");
      } else {
        setMessage("");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessage(error instanceof Error ? error.message : "사진첩을 불러오지 못했어요.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialPhotos() {
      setLoading(true);
      try {
        const response = await fetch("/api/public-photos", {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await response.json() as GalleryPayload;
        if (!response.ok) throw new Error(json.error || "사진첩을 불러오지 못했어요.");

        setGroups(json.groups || []);
        if (json.setup_required) {
          setMessage(json.error || "사진첩 버킷을 준비하면 사진이 여기에 보여요.");
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessage(error instanceof Error ? error.message : "사진첩을 불러오지 못했어요.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadInitialPhotos();
    return () => controller.abort();
  }, []);

  function openPhoto(photo: GalleryPhoto, group: GalleryGroup) {
    const index = flatPhotos.findIndex((item) => item.photo.id === photo.id && item.group.date === group.date);
    if (index >= 0) setSelectedIndex(index);
  }

  function moveSelected(delta: number) {
    setSelectedIndex((current) => {
      if (current === null || !flatPhotos.length) return current;
      return (current + delta + flatPhotos.length) % flatPhotos.length;
    });
  }

  return (
    <section className="card mobile-page-card mt-4 overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-black leading-tight text-oriwan-text">스내사 포토로그</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-oriwan-surface-light px-3 py-1.5 text-xs font-black text-oriwan-text-muted ring-1 ring-slate-950/5">
            {loading ? "불러오는 중" : `${flatPhotos.length}장`}
          </span>
          <button
            type="button"
            onClick={() => loadPhotos(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-oriwan-text ring-1 ring-slate-950/5 transition hover:bg-lime-50"
            aria-label="사진첩 새로고침"
          >
            <IconSync size={16} />
          </button>
        </div>
      </div>

      {message && !groups.length && (
        <div className="rounded-[24px] bg-oriwan-surface-light px-4 py-8 text-center text-sm font-bold leading-6 text-oriwan-text-muted ring-1 ring-slate-950/5">
          {message}
        </div>
      )}

      {!message && loading && !groups.length && (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-[18px] bg-oriwan-surface-light" />
          ))}
        </div>
      )}

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.date}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-oriwan-text">{group.date_label}</p>
                <p className="mt-0.5 truncate text-[11px] font-bold text-oriwan-text-muted">{group.album_title}</p>
              </div>
              <span className="shrink-0 rounded-full bg-oriwan-surface-light px-2.5 py-1 text-[10px] font-black text-oriwan-text-muted">
                {group.photos.length}장
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
              {group.photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => openPhoto(photo, group)}
                  className="group relative aspect-square overflow-hidden rounded-[18px] bg-oriwan-surface-light ring-1 ring-slate-950/5 transition hover:-translate-y-0.5 hover:ring-lime-300"
                  aria-label={`${group.date_label} 사진 보기`}
                >
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <PhotoViewer
          selected={{ ...selected, index: selectedIndex || 0 }}
          total={flatPhotos.length}
          onClose={() => setSelectedIndex(null)}
          onPrev={() => moveSelected(-1)}
          onNext={() => moveSelected(1)}
        />
      )}
    </section>
  );
}

function PhotoViewer({
  selected,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  selected: SelectedPhoto;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 px-3 py-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex h-full w-full max-w-5xl flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3 text-white">
          <div className="min-w-0">
            <p className="text-sm font-black">{selected.group.date_label}</p>
            <p className="truncate text-[11px] font-bold text-white/55">{selected.group.album_title}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white/70 ring-1 ring-white/10">
              {selected.index + 1}/{total}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950 transition hover:bg-lime-200"
              aria-label="닫기"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] bg-black">
          <img src={selected.photo.url} alt="" className="h-full w-full object-contain" />
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={onPrev}
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-black text-slate-950 shadow-lg transition hover:bg-lime-200"
                aria-label="이전 사진"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={onNext}
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-black text-slate-950 shadow-lg transition hover:bg-lime-200"
                aria-label="다음 사진"
              >
                ›
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
