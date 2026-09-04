"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { TwttBrandMark } from "@/components/twtt-brand-mark";

import {
  MAX_LOCAL_ADS,
  MAX_LOCAL_QUOTES,
  MAX_PROFILE_BODY_LENGTH,
  MAX_PROFILE_TITLE_LENGTH,
  getLocalStorageEstimate,
  optimizeLocalImage,
  readLocalHello2027Config,
  writeLocalHello2027Config,
  type Hello2027LocalConfig,
} from "../hello-2027-local-repository";
import type { Hello2027Ad, Hello2027Snapshot } from "../hello-2027-poc-data";
import { TwttRunnerPictogram } from "../twtt-runner-pictogram";
import { useLocalHello2027Content } from "../use-local-hello-2027-content";
import styles from "./hello-2027-local-manager.module.css";

type Hello2027LocalManagerProps = {
  snapshot: Hello2027Snapshot;
};

type AdDraft = {
  id: string | null;
  ownerName: string;
  title: string;
  description: string;
  alt: string;
};

type ProfileDraft = {
  participantId: string;
  title: string;
  body: string;
};

const DEFAULT_SCENE = "/images/poc/hello-2027/hello-2027-riverside.webp";

function createMediaId(kind: "ad" | "avatar") {
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${kind}:${id}`;
}

function createEmptyDraft(): AdDraft {
  return { id: null, ownerName: "", title: "", description: "", alt: "" };
}

function normalizeProfileBody(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatBytes(bytes: number | undefined) {
  if (!bytes) return "0MB";
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}

export function Hello2027LocalManager({ snapshot }: Hello2027LocalManagerProps) {
  const defaultConfig = useMemo<Hello2027LocalConfig>(() => ({
    version: 3,
    ads: snapshot.ads.map((ad) => ({ ...ad })),
    avatars: {},
    encouragements: [...snapshot.encouragements],
    profileIntroductions: {},
  }), [snapshot.ads, snapshot.encouragements]);
  const [config, setConfig] = useState<Hello2027LocalConfig>(defaultConfig);
  const [adDraft, setAdDraft] = useState<AdDraft>(createEmptyDraft);
  const [adFile, setAdFile] = useState<File | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState(snapshot.participants[0]?.id ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const [quoteDraft, setQuoteDraft] = useState("");
  const [editingQuoteIndex, setEditingQuoteIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [storageLabel, setStorageLabel] = useState("계산 중");
  const adFileRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const localContent = useLocalHello2027Content(snapshot.ads, snapshot.encouragements);

  const refreshStorageLabel = async () => {
    const estimate = await getLocalStorageEstimate().catch(() => null);
    if (!estimate) {
      setStorageLabel("이 브라우저에서 용량 확인 불가");
      return;
    }
    setStorageLabel(`${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)} 사용`);
  };

  useEffect(() => {
    let active = true;
    void readLocalHello2027Config()
      .then((storedConfig) => {
        if (active && storedConfig) {
          setConfig({
            ...storedConfig,
            encouragements: storedConfig.encouragements.length > 0
              ? storedConfig.encouragements
              : [...snapshot.encouragements],
          });
        }
      })
      .catch(() => {
        if (active) setError("저장된 운영자 데이터를 불러오지 못했어요.");
      });
    void getLocalStorageEstimate()
      .then((estimate) => {
        if (!active) return;
        setStorageLabel(estimate ? `${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)} 사용` : "이 브라우저에서 용량 확인 불가");
      })
      .catch(() => {
        if (active) setStorageLabel("이 브라우저에서 용량 확인 불가");
      });
    return () => {
      active = false;
    };
  }, [snapshot.encouragements]);

  const selectedParticipant = snapshot.participants.find((participant) => participant.id === selectedParticipantId)
    ?? snapshot.participants[0];
  const selectedAvatarUrl = selectedParticipant ? localContent.avatarUrls[selectedParticipant.id] : undefined;
  const storedIntroduction = selectedParticipant ? config.profileIntroductions[selectedParticipant.id] : undefined;
  const activeProfileDraft = selectedParticipant
    ? profileDraft?.participantId === selectedParticipant.id
      ? profileDraft
      : {
          participantId: selectedParticipant.id,
          title: storedIntroduction?.title ?? selectedParticipant.product.name,
          body: storedIntroduction?.body ?? selectedParticipant.product.description,
        }
    : null;
  const profileTitle = activeProfileDraft?.title ?? "";
  const profileBody = activeProfileDraft?.body ?? "";

  const resetAdForm = () => {
    setAdDraft(createEmptyDraft());
    setAdFile(null);
    if (adFileRef.current) adFileRef.current.value = "";
  };

  const submitAd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const ownerName = adDraft.ownerName.trim();
    const title = adDraft.title.trim();
    const description = adDraft.description.trim();
    const alt = adDraft.alt.trim();
    if (!ownerName || !title || !description || !alt) {
      setError("광고주, 제목, 설명, 이미지 설명을 모두 입력해주세요.");
      return;
    }

    const existingAd = adDraft.id ? config.ads.find((ad) => ad.id === adDraft.id) : null;
    if (!existingAd && config.ads.length >= MAX_LOCAL_ADS) {
      setError(`광고는 최대 ${MAX_LOCAL_ADS}개까지 등록할 수 있어요.`);
      return;
    }

    setSaving(true);
    try {
      let mediaId = existingAd?.mediaId;
      let mediaWrite: { id: string; blob: Blob } | null = null;
      const mediaDeletes: string[] = [];
      if (adFile) {
        const optimized = await optimizeLocalImage(adFile, "ad");
        const nextMediaId = createMediaId("ad");
        mediaWrite = { id: nextMediaId, blob: optimized.blob };
        if (mediaId) mediaDeletes.push(mediaId);
        mediaId = nextMediaId;
      }

      const nextAd: Hello2027Ad = {
        id: existingAd?.id ?? `ad-${typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now()}`,
        ownerName,
        title,
        description,
        alt,
        imageSrc: existingAd?.imageSrc || DEFAULT_SCENE,
        ...(mediaId ? { mediaId } : {}),
      };
      const ads = existingAd
        ? config.ads.map((ad) => ad.id === existingAd.id ? nextAd : ad)
        : [...config.ads, nextAd];
      const nextConfig = { ...config, ads };
      await writeLocalHello2027Config(nextConfig, mediaWrite ? [mediaWrite] : [], mediaDeletes);
      setConfig(nextConfig);
      resetAdForm();
      setMessage(existingAd ? "광고를 수정했어요." : "광고를 추가했어요.");
      await refreshStorageLabel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "광고를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const editAd = (ad: Hello2027Ad) => {
    setAdDraft({
      id: ad.id,
      ownerName: ad.ownerName,
      title: ad.title,
      description: ad.description,
      alt: ad.alt,
    });
    setAdFile(null);
    if (adFileRef.current) adFileRef.current.value = "";
    window.requestAnimationFrame(() => document.getElementById("ad-owner")?.focus());
  };

  const moveAd = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= config.ads.length) return;
    const ads = [...config.ads];
    [ads[index], ads[targetIndex]] = [ads[targetIndex], ads[index]];
    const nextConfig = { ...config, ads };
    try {
      await writeLocalHello2027Config(nextConfig);
      setConfig(nextConfig);
      setMessage("광고 순서를 바꿨어요.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "광고 순서를 저장하지 못했어요.");
    }
  };

  const deleteAd = async (ad: Hello2027Ad) => {
    if (!window.confirm(`‘${ad.title}’ 광고를 이 브라우저에서 삭제할까요?`)) return;
    const nextConfig = { ...config, ads: config.ads.filter((item) => item.id !== ad.id) };
    try {
      await writeLocalHello2027Config(nextConfig, [], ad.mediaId ? [ad.mediaId] : []);
      setConfig(nextConfig);
      if (adDraft.id === ad.id) resetAdForm();
      setMessage("광고를 삭제했어요.");
      await refreshStorageLabel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "광고를 삭제하지 못했어요.");
    }
  };

  const saveAvatar = async () => {
    if (!selectedParticipant || !avatarFile) {
      setError("변경할 크루와 얼굴 이미지를 선택해주세요.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const optimized = await optimizeLocalImage(avatarFile, "avatar");
      const mediaId = createMediaId("avatar");
      const previousMediaId = config.avatars[selectedParticipant.id];
      const nextConfig = {
        ...config,
        avatars: { ...config.avatars, [selectedParticipant.id]: mediaId },
      };
      await writeLocalHello2027Config(
        nextConfig,
        [{ id: mediaId, blob: optimized.blob }],
        previousMediaId ? [previousMediaId] : [],
      );
      setConfig(nextConfig);
      setAvatarFile(null);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
      setMessage(`${selectedParticipant.fullName}님의 얼굴 이미지를 변경했어요.`);
      await refreshStorageLabel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "얼굴 이미지를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const resetAvatar = async () => {
    if (!selectedParticipant) return;
    const previousMediaId = config.avatars[selectedParticipant.id];
    if (!previousMediaId) return;
    if (!window.confirm(`${selectedParticipant.fullName}님의 얼굴 이미지를 기본 캐릭터로 되돌릴까요?`)) return;
    const avatars = { ...config.avatars };
    delete avatars[selectedParticipant.id];
    const nextConfig = { ...config, avatars };
    try {
      await writeLocalHello2027Config(nextConfig, [], [previousMediaId]);
      setConfig(nextConfig);
      setMessage("기본 캐릭터로 되돌렸어요.");
      await refreshStorageLabel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "기본 캐릭터로 되돌리지 못했어요.");
    }
  };

  const submitProfileIntroduction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedParticipant) return;
    const title = profileTitle.replace(/\s+/g, " ").trim();
    const body = normalizeProfileBody(profileBody);
    setMessage("");
    setError("");
    if (!title || !body) {
      setError("소개 제목과 자기소개를 모두 입력해주세요.");
      return;
    }
    if (title.length > MAX_PROFILE_TITLE_LENGTH || body.length > MAX_PROFILE_BODY_LENGTH) {
      setError(`소개 제목은 ${MAX_PROFILE_TITLE_LENGTH}자, 자기소개는 ${MAX_PROFILE_BODY_LENGTH}자 이내로 입력해주세요.`);
      return;
    }

    const nextConfig: Hello2027LocalConfig = {
      ...config,
      profileIntroductions: {
        ...config.profileIntroductions,
        [selectedParticipant.id]: { title, body },
      },
    };
    setSaving(true);
    try {
      await writeLocalHello2027Config(nextConfig);
      setConfig(nextConfig);
      setProfileDraft({ participantId: selectedParticipant.id, title, body });
      setMessage(`${selectedParticipant.fullName}님의 자기소개를 저장했어요.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "자기소개를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const resetProfileIntroduction = async () => {
    if (!selectedParticipant || !config.profileIntroductions[selectedParticipant.id]) return;
    const profileIntroductions = { ...config.profileIntroductions };
    delete profileIntroductions[selectedParticipant.id];
    const nextConfig: Hello2027LocalConfig = { ...config, profileIntroductions };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await writeLocalHello2027Config(nextConfig);
      setConfig(nextConfig);
      setProfileDraft({
        participantId: selectedParticipant.id,
        title: selectedParticipant.product.name,
        body: selectedParticipant.product.description,
      });
      setMessage(`${selectedParticipant.fullName}님의 기본 소개로 되돌렸어요.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "기본 소개로 되돌리지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const resetQuoteForm = () => {
    setQuoteDraft("");
    setEditingQuoteIndex(null);
  };

  const submitQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const quote = quoteDraft.replace(/\s+/g, " ").trim();
    if (!quote) {
      setError("응원글을 입력해주세요.");
      return;
    }
    if (quote.length > 120) {
      setError("응원글은 120자 이내로 입력해주세요.");
      return;
    }
    const duplicated = config.encouragements.some((item, index) => (
      index !== editingQuoteIndex && item.toLocaleLowerCase("ko") === quote.toLocaleLowerCase("ko")
    ));
    if (duplicated) {
      setError("같은 응원글이 이미 등록되어 있어요.");
      return;
    }
    if (editingQuoteIndex === null && config.encouragements.length >= MAX_LOCAL_QUOTES) {
      setError(`응원글은 최대 ${MAX_LOCAL_QUOTES}개까지 등록할 수 있어요.`);
      return;
    }

    const encouragements = editingQuoteIndex === null
      ? [...config.encouragements, quote]
      : config.encouragements.map((item, index) => index === editingQuoteIndex ? quote : item);
    const nextConfig = { ...config, encouragements };
    setSaving(true);
    try {
      await writeLocalHello2027Config(nextConfig);
      setConfig(nextConfig);
      resetQuoteForm();
      setMessage(editingQuoteIndex === null ? "응원글을 추가했어요." : "응원글을 수정했어요.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "응원글을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const editQuote = (index: number) => {
    setEditingQuoteIndex(index);
    setQuoteDraft(config.encouragements[index] ?? "");
    window.requestAnimationFrame(() => document.getElementById("quote-body")?.focus());
  };

  const moveQuote = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= config.encouragements.length) return;
    const encouragements = [...config.encouragements];
    [encouragements[index], encouragements[targetIndex]] = [encouragements[targetIndex], encouragements[index]];
    const nextConfig = { ...config, encouragements };
    try {
      await writeLocalHello2027Config(nextConfig);
      setConfig(nextConfig);
      resetQuoteForm();
      setMessage("응원글 순서를 바꿨어요.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "응원글 순서를 저장하지 못했어요.");
    }
  };

  const deleteQuote = async (index: number) => {
    if (config.encouragements.length <= 1) {
      setError("응원글은 한 개 이상 남겨주세요.");
      return;
    }
    if (!window.confirm("이 응원글을 이 브라우저에서 삭제할까요?")) return;
    const encouragements = config.encouragements.filter((_, itemIndex) => itemIndex !== index);
    const nextConfig = { ...config, encouragements };
    try {
      await writeLocalHello2027Config(nextConfig);
      setConfig(nextConfig);
      resetQuoteForm();
      setMessage("응원글을 삭제했어요.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "응원글을 삭제하지 못했어요.");
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <TwttBrandMark className="mb-3 aspect-[640/310] w-[132px]" sizes="132px" priority label="TWTT" />
          <span>LOCAL POC</span>
          <h1>Hello 2027 운영자 관리</h1>
          <p>광고, 크루 프로필, 오늘의 응원글을 이 브라우저 안에서만 미리 관리할 수 있어요.</p>
        </div>
        <Link href="/poc/hello-2027">대시보드 보기</Link>
      </header>

      <aside className={styles.localNotice}>
        <strong>개발용 로컬 데이터</strong>
        <p>기존 어드민과 Supabase에는 연결되지 않습니다. 브라우저 데이터를 지우면 등록 내용도 사라져요.</p>
        <span>{storageLabel}</span>
      </aside>

      <p className={styles.statusMessage} role="status" aria-live="polite">
        {error ? <span className={styles.error}>{error}</span> : message}
      </p>

      <section className={styles.section} aria-labelledby="ad-manager-title">
        <div className={styles.sectionHeading}>
          <div>
            <span>BANNER</span>
            <h2 id="ad-manager-title">크루 광고</h2>
          </div>
          <strong>{config.ads.length} / {MAX_LOCAL_ADS}</strong>
        </div>

        <div className={styles.adLayout}>
          <ol className={styles.adList}>
            {config.ads.map((ad, index) => {
              const resolvedAd = localContent.ads.find((item) => item.id === ad.id);
              return (
                <li key={ad.id}>
                  <div className={styles.adThumbnail}>
                    <Image
                      src={resolvedAd?.imageSrc || ad.imageSrc || DEFAULT_SCENE}
                      alt=""
                      fill
                      unoptimized={Boolean(resolvedAd?.isUploaded)}
                      sizes="180px"
                    />
                  </div>
                  <div className={styles.adSummary}>
                    <span>{ad.ownerName}</span>
                    <strong>{ad.title}</strong>
                    <p>{ad.description}</p>
                  </div>
                  <div className={styles.adActions}>
                    <button type="button" disabled={index === 0} onClick={() => void moveAd(index, -1)} aria-label={`${ad.title} 광고를 앞으로 이동`}>↑</button>
                    <button type="button" disabled={index === config.ads.length - 1} onClick={() => void moveAd(index, 1)} aria-label={`${ad.title} 광고를 뒤로 이동`}>↓</button>
                    <button type="button" onClick={() => editAd(ad)}>수정</button>
                    <button type="button" className={styles.deleteButton} onClick={() => void deleteAd(ad)}>삭제</button>
                  </div>
                </li>
              );
            })}
          </ol>

          <form className={styles.adForm} onSubmit={submitAd}>
            <h3>{adDraft.id ? "광고 수정" : "새 광고 등록"}</h3>
            <label htmlFor="ad-owner">광고주</label>
            <input id="ad-owner" value={adDraft.ownerName} maxLength={20} onChange={(event) => setAdDraft((current) => ({ ...current, ownerName: event.target.value }))} />
            <label htmlFor="ad-title">광고 제목</label>
            <input id="ad-title" value={adDraft.title} maxLength={40} onChange={(event) => setAdDraft((current) => ({ ...current, title: event.target.value }))} />
            <label htmlFor="ad-description">광고 설명</label>
            <textarea id="ad-description" value={adDraft.description} maxLength={100} onChange={(event) => setAdDraft((current) => ({ ...current, description: event.target.value }))} />
            <label htmlFor="ad-alt">이미지 설명</label>
            <input id="ad-alt" value={adDraft.alt} maxLength={80} placeholder="예: 파란 배경의 커피 도구 광고" onChange={(event) => setAdDraft((current) => ({ ...current, alt: event.target.value }))} />
            <label htmlFor="ad-image">광고 이미지 <small>선택 · JPG/PNG/WebP, 5MB 이하</small></label>
            <input ref={adFileRef} id="ad-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAdFile(event.target.files?.[0] ?? null)} />
            <div className={styles.formActions}>
              {adDraft.id ? <button type="button" onClick={resetAdForm}>취소</button> : null}
              <button type="submit" disabled={saving || (!adDraft.id && config.ads.length >= MAX_LOCAL_ADS)}>{saving ? "저장 중" : adDraft.id ? "수정 저장" : "광고 추가"}</button>
            </div>
          </form>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="quote-manager-title">
        <div className={styles.sectionHeading}>
          <div>
            <span>CHEER</span>
            <h2 id="quote-manager-title">오늘의 응원글</h2>
          </div>
          <strong>{config.encouragements.length} / {MAX_LOCAL_QUOTES}</strong>
        </div>
        <p className={styles.sectionIntro}>대시보드에서 8초마다 차례로 바뀌며, 최대 56개까지 등록할 수 있어요.</p>

        <div className={styles.quoteLayout}>
          <ol className={styles.quoteList}>
            {config.encouragements.map((quote, index) => (
              <li key={`${index}-${quote}`}>
                <span className={styles.quoteNumber}>{String(index + 1).padStart(2, "0")}</span>
                <p>{quote}</p>
                <div className={styles.quoteActions}>
                  <button type="button" disabled={index === 0} onClick={() => void moveQuote(index, -1)} aria-label={`${index + 1}번째 응원글을 앞으로 이동`}>↑</button>
                  <button type="button" disabled={index === config.encouragements.length - 1} onClick={() => void moveQuote(index, 1)} aria-label={`${index + 1}번째 응원글을 뒤로 이동`}>↓</button>
                  <button type="button" onClick={() => editQuote(index)}>수정</button>
                  <button type="button" className={styles.deleteButton} disabled={config.encouragements.length <= 1} onClick={() => void deleteQuote(index)}>삭제</button>
                </div>
              </li>
            ))}
          </ol>

          <form className={styles.quoteForm} onSubmit={submitQuote}>
            <h3>{editingQuoteIndex === null ? "새 응원글 등록" : `${editingQuoteIndex + 1}번째 응원글 수정`}</h3>
            <label htmlFor="quote-body">응원글</label>
            <textarea
              id="quote-body"
              value={quoteDraft}
              maxLength={120}
              required
              placeholder="편안하게 함께 달리는 마음을 적어주세요."
              onChange={(event) => setQuoteDraft(event.target.value)}
            />
            <span className={styles.fieldCounter}>{quoteDraft.length}/120</span>
            <div className={styles.formActions}>
              {editingQuoteIndex !== null ? <button type="button" onClick={resetQuoteForm}>취소</button> : null}
              <button type="submit" disabled={saving || (editingQuoteIndex === null && config.encouragements.length >= MAX_LOCAL_QUOTES)}>
                {saving ? "저장 중" : editingQuoteIndex === null ? "응원글 추가" : "수정 저장"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="avatar-manager-title">
        <div className={styles.sectionHeading}>
          <div>
            <span>CREW PROFILE</span>
            <h2 id="avatar-manager-title">크루 프로필</h2>
          </div>
        </div>
        <p className={styles.sectionIntro}>크루별 얼굴 이미지와 상세 화면의 자기소개를 함께 관리해요.</p>

        <div className={styles.avatarManager}>
          <div className={styles.avatarPreview} aria-hidden="true">
            {selectedParticipant && selectedAvatarUrl ? (
              <Image src={selectedAvatarUrl} alt="" fill unoptimized sizes="160px" />
            ) : selectedParticipant ? (
              <TwttRunnerPictogram
                variant={selectedParticipant.pictogramIndex}
                name={selectedParticipant.fullName}
                completed={selectedParticipant.completed}
                pose="stand"
                portrait
                size="dialog"
              />
            ) : null}
          </div>
          <div className={styles.avatarFields}>
            <label htmlFor="avatar-participant">크루 선택</label>
            <select
              id="avatar-participant"
              value={selectedParticipantId}
              onChange={(event) => {
                setSelectedParticipantId(event.target.value);
                setProfileDraft(null);
              }}
            >
              {snapshot.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.fullName}</option>)}
            </select>
            <label htmlFor="avatar-image">얼굴 이미지 <small>JPG/PNG/WebP, 3MB 이하</small></label>
            <input ref={avatarFileRef} id="avatar-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} />
            <p>이미지는 중앙을 기준으로 정사각형으로 잘리며, 서버로 전송되지 않아요.</p>
            <div className={styles.formActions}>
              <button type="button" disabled={!config.avatars[selectedParticipantId]} onClick={() => void resetAvatar()}>기본 캐릭터</button>
              <button type="button" disabled={!avatarFile || saving} onClick={() => void saveAvatar()}>{saving ? "저장 중" : "얼굴 이미지 저장"}</button>
            </div>

            <form className={styles.profileForm} onSubmit={submitProfileIntroduction}>
              <h3>상세 자기소개</h3>
              <label htmlFor="profile-title">소개 제목</label>
              <input
                id="profile-title"
                value={profileTitle}
                maxLength={MAX_PROFILE_TITLE_LENGTH}
                required
                placeholder="예: 서아의 식탁"
                onChange={(event) => selectedParticipant && setProfileDraft({
                  participantId: selectedParticipant.id,
                  title: event.target.value,
                  body: profileBody,
                })}
              />
              <span className={styles.fieldCounter}>{profileTitle.length}/{MAX_PROFILE_TITLE_LENGTH}</span>
              <label htmlFor="profile-body">자기소개</label>
              <textarea
                id="profile-body"
                value={profileBody}
                maxLength={MAX_PROFILE_BODY_LENGTH}
                required
                placeholder="크루를 소개하는 짧은 글을 적어주세요."
                onChange={(event) => selectedParticipant && setProfileDraft({
                  participantId: selectedParticipant.id,
                  title: profileTitle,
                  body: event.target.value,
                })}
              />
              <span className={styles.fieldCounter}>{profileBody.length}/{MAX_PROFILE_BODY_LENGTH}</span>
              <div className={styles.formActions}>
                <button
                  type="button"
                  disabled={!selectedParticipant || !config.profileIntroductions[selectedParticipant.id] || saving}
                  onClick={() => void resetProfileIntroduction()}
                >
                  기본 소개
                </button>
                <button type="submit" disabled={!selectedParticipant || saving}>{saving ? "저장 중" : "자기소개 저장"}</button>
              </div>
            </form>
          </div>
        </div>

        {selectedParticipant ? (
          <div className={styles.profilePreview} aria-label={`${selectedParticipant.fullName}님의 자기소개 미리보기`}>
            <span>크루 소개 · {selectedParticipant.fullName}</span>
            <strong>{profileTitle || "소개 제목"}</strong>
            <p>{profileBody || "자기소개가 여기에 표시돼요."}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
