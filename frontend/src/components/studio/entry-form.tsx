"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Bold,
  CalendarDays,
  Database,
  Eye,
  Heart,
  HelpCircle,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  MapPin,
  Pencil,
  Plus,
  Quote,
  Send,
  Sparkles,
  Underline,
  User,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approvalsApi,
  authApi,
  destinationsApi,
  notificationsApi,
} from "@/lib/api/services";
import type {
  CurrentUser,
  Destination,
  DestinationCategory,
  Province,
} from "@/lib/api/types";
import { classNames } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { EntryMap } from "@/components/studio/entry-map";

type EntryTab = "basic" | "media" | "practical" | "seo";

const CATEGORY_CHIPS: Array<{ value: DestinationCategory; label: string }> = [
  { value: "NATURE", label: "Thiên nhiên" },
  { value: "CULTURE", label: "Văn hóa" },
  { value: "HISTORY", label: "Lịch sử" },
  { value: "CUISINE", label: "Ẩm thực" },
  { value: "RELIGION", label: "Tâm linh" },
  { value: "ENTERTAINMENT", label: "Giải trí" },
];

const STAGES = [
  { key: "student", label: "Student", sub: "Đang nhập" },
  { key: "leader", label: "Leader", sub: "Chờ duyệt" },
  { key: "lecturer", label: "Lecturer", sub: "Duyệt là xong" },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯđ]/g, (c) => (c === "đ" ? "d" : ""))
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface TextTransform {
  id: string;
  title: string;
  icon: React.ReactNode;
  apply: (value: string, s: number, e: number) => { value: string; sel: [number, number] };
}

function wrapTransform(
  before: string,
  after = "",
): TextTransform["apply"] {
  return (value, s, e) => ({
    value: value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e),
    sel: [s + before.length, e + before.length],
  });
}

function lineTransform(
  prefix: string | ((i: number) => string),
): TextTransform["apply"] {
  return (value, s, e) => {
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const end = value.indexOf("\n", e);
    const block = value.slice(start, end === -1 ? undefined : end);
    const next = block
      .split("\n")
      .map((ln, i) => `${typeof prefix === "function" ? prefix(i) : prefix}${ln}`)
      .join("\n");
    const tail = end === -1 ? "" : value.slice(end);
    return { value: value.slice(0, start) + next + tail, sel: [s, s] };
  };
}

const TEXT_TOOLS: TextTransform[] = [
  { id: "bold", title: "Đậm", icon: <Bold className="size-4" />, apply: wrapTransform("**", "**") },
  { id: "italic", title: "Nghiêng", icon: <Italic className="size-4" />, apply: wrapTransform("*", "*") },
  { id: "underline", title: "Gạch chân", icon: <Underline className="size-4" />, apply: wrapTransform("<u>", "</u>") },
  { id: "h2", title: "Tiêu đề", icon: <span className="text-xs font-black">H₂</span>, apply: lineTransform("## ") },
  { id: "ul", title: "Gạch đầu dòng", icon: <List className="size-4" />, apply: lineTransform("- ") },
  { id: "ol", title: "Danh sách số", icon: <ListOrdered className="size-4" />, apply: lineTransform((i) => `${i + 1}. `) },
  { id: "quote", title: "Trích dẫn", icon: <Quote className="size-4" />, apply: lineTransform("> ") },
  { id: "link", title: "Liên kết", icon: <Link2 className="size-4" />, apply: wrapTransform("[", "](https://)") },
];

function stageOf(status: string | undefined): number {
  switch (status) {
    case "PENDING_LEADER":
      return 2;
    case "PENDING_LECTURER":
      return 3;
    case "PENDING_ADMIN":
      // Legacy rows (lecturer is now final) — still show as awaiting lecturer.
      return 3;
    case "PUBLISHED":
      return 4;
    default:
      return 1;
  }
}

interface EntryFormProps {
  user: CurrentUser;
  provinces: Province[];
  initial: Destination | null;
}

/**
 * Student destination entry workspace: icon rail, header with approval
 * stepper, tabbed form and the pick-on-map panel.
 */
export function EntryForm({ user, provinces, initial }: EntryFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = React.useState<EntryTab>("basic");
  const [collapsed, setCollapsed] = React.useState(false);
  const [mapOpen, setMapOpen] = React.useState(true);
  const [pickMode, setPickMode] = React.useState(false);
  const [showSurrounding, setShowSurrounding] = React.useState(true);

  const [name, setName] = React.useState(initial?.name ?? "");
  const [slug, setSlug] = React.useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(!!initial);
  const [category, setCategory] = React.useState<DestinationCategory | null>(
    initial?.category ?? null,
  );
  const [address, setAddress] = React.useState(initial?.address ?? "");
  const [provinceId, setProvinceId] = React.useState(initial?.provinceId ?? "");
  const [lat, setLat] = React.useState(initial ? String(initial.lat) : "");
  const [lng, setLng] = React.useState(initial ? String(initial.lng) : "");
  const [shortDesc, setShortDesc] = React.useState(
    typeof initial?.description === "string" ? initial.description.split("\n")[0] ?? "" : "",
  );
  const [longDesc, setLongDesc] = React.useState(
    typeof initial?.description === "string" ? initial.description : "",
  );
  const [keywords, setKeywords] = React.useState<string[]>(() =>
    readKeywords(initial?.openingHours),
  );
  const [keywordInput, setKeywordInput] = React.useState("");
  const [images, setImages] = React.useState<string[]>(initial?.images ?? []);
  const [imageInput, setImageInput] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [hours, setHours] = React.useState(() => readHours(initial?.openingHours));
  const [ticket, setTicket] = React.useState(
    initial?.ticketPrice != null ? String(initial.ticketPrice) : "",
  );

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [savedId, setSavedId] = React.useState<string | null>(initial?.id ?? null);
  const [status, setStatus] = React.useState<string>(initial?.status ?? "DRAFT");
  const [savedAt, setSavedAt] = React.useState<string | null>(
    initial ? new Date(initial.updatedAt).toLocaleTimeString("vi-VN") : null,
  );

  const unread = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationsApi.list({ limit: 20 }),
  }).data;
  const unreadCount = (unread?.data ?? []).filter((n) => !n.readAt).length;

  // Provinces this account may enter data for. Null = unscoped role (or
  // failed fetch) → the full list; otherwise restricted to assignments.
  const myProvinces = useQuery({
    queryKey: ["user", "my-provinces"],
    queryFn: () => authApi.myProvinces().catch(() => null),
  }).data;
  const assigned = React.useMemo(
    () => (myProvinces ?? []).map((r) => r.province).filter((p) => p && p.id),
    [myProvinces],
  );
  const scoped = user.role === "STUDENT" || user.role === "LEADER";
  const provinceOptions: Province[] = React.useMemo(() => {
    const base = assigned.length > 0 ? assigned : provinces;
    if (initial?.provinceId && !base.some((p) => p.id === initial.provinceId)) {
      const current = provinces.find((p) => p.id === initial.provinceId);
      if (current) return [current, ...base];
    }
    return base;
  }, [assigned, provinces, initial]);
  // Single assignment → preselected without extra state.
  const effectiveProvinceId =
    provinceId || (assigned.length === 1 ? assigned[0].id : "");

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const coordsValid =
    lat.trim() !== "" &&
    lng.trim() !== "" &&
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    Math.abs(latNum) <= 90 &&
    Math.abs(lngNum) <= 180;

  const surrounding = useQuery({
    queryKey: ["destinations", "entry-surrounding", coordsValid ? [lngNum, latNum] : null],
    queryFn: () =>
      destinationsApi.bbox({
        minLng: lngNum - 1.5,
        minLat: latNum - 1.5,
        maxLng: lngNum + 1.5,
        maxLat: latNum + 1.5,
        limit: 60,
      }),
    enabled: coordsValid && showSurrounding,
  });

  const provinceName = provinces.find((p) => p.id === effectiveProvinceId)?.name;
  const stage = stageOf(status);
  const longRef = React.useRef<HTMLTextAreaElement | null>(null);

  const onName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const onPick = (nextLng: number, nextLat: number) => {
    setLng(String(nextLng));
    setLat(String(nextLat));
    setErrors((prev) => {
      if (!prev.lat && !prev.lng) return prev;
      const next = { ...prev };
      delete next.lat;
      delete next.lng;
      return next;
    });
  };

  function validate(): Record<string, unknown> | null {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Nhập tên điểm đến";
    if (!category) errs.category = "Chọn loại hình du lịch";
    if (!address.trim()) errs.address = "Nhập địa chỉ chi tiết";
    if (!coordsValid) {
      if (lat.trim() === "" || !Number.isFinite(latNum) || Math.abs(latNum) > 90)
        errs.lat = "Vĩ độ  -90…90";
      if (lng.trim() === "" || !Number.isFinite(lngNum) || Math.abs(lngNum) > 180)
        errs.lng = "Kinh độ -180…180";
    }
    if (!shortDesc.trim()) errs.shortDesc = "Nhập mô tả ngắn";
    if (!longDesc.trim()) errs.longDesc = "Nhập mô tả chi tiết";
    const finalSlug = slug.trim() || slugify(name);
    if (!finalSlug) errs.slug = "Slug không được trống";
    if (!effectiveProvinceId) errs.province = "Chọn tỉnh/thành phố (bắt buộc)";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // Province/slug errors live on the SEO tab — jump straight there.
      setTab(errs.province || errs.slug ? "seo" : "basic");
      return null;
    }
    return {
      name: name.trim(),
      slug: finalSlug,
      description: longDesc.trim(),
      category: category!,
      address: address.trim(),
      provinceId: effectiveProvinceId || undefined,
      images,
      openingHours: {
        ...(hours.trim() ? { hours: hours.trim() } : {}),
        ...(keywords.length ? { keywords } : {}),
      },
      ticketPrice: ticket.trim() === "" ? undefined : Number(ticket.replace(/[^\d]/g, "")),
      lng: lngNum,
      lat: latNum,
    };
  }

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (savedId) return destinationsApi.update(savedId, body);
      const created = await destinationsApi.create(body as Parameters<typeof destinationsApi.create>[0]);
      return created;
    },
    onSuccess: (result) => {
      const dest = result as Destination;
      setSavedId(dest.id);
      setStatus(dest.status);
      setSavedAt(new Date().toLocaleTimeString("vi-VN"));
      queryClient.invalidateQueries({ queryKey: ["destination"] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (entityId: string) =>
      approvalsApi.submit({ entityType: "DESTINATION", entityId }),
    onSuccess: () => {
      setStatus("PENDING_LEADER");
      toast({ title: "Đã gửi duyệt", description: "Điểm đến đang chờ Leader xét duyệt.", variant: "success" });
    },
    onError: (e) => {
      toast({ title: "Gửi duyệt thất bại", description: e instanceof Error ? e.message : undefined, variant: "error" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      let id = savedId;
      if (!id) {
        const body = validate();
        if (!body) throw new Error("Hoàn thiện thông tin cơ bản trước khi tìm ảnh");
        const created = (await saveMutation.mutateAsync(body)) as Destination;
        id = created.id;
      }
      return destinationsApi.resolveImage(id);
    },
    onSuccess: (result) => {
      setImages((prev) => Array.from(new Set([...prev, ...(result.images ?? [])])));
      toast({ title: "Đã tìm ảnh", description: "Ảnh Wikipedia đã được thêm vào thư viện.", variant: "success" });
    },
    onError: (e) => {
      toast({ title: "Không tìm được ảnh", description: e instanceof Error ? e.message : undefined, variant: "error" });
    },
  });

  const handleSave = async () => {
    const body = validate();
    if (!body) return;
    try {
      await saveMutation.mutateAsync(body);
      toast({ title: "Đã lưu nháp", description: "Mở “Dữ liệu đã lưu” để xem lại bất cứ lúc nào.", variant: "success" });
    } catch (e) {
      toast({ title: "Lưu thất bại", description: e instanceof Error ? e.message : undefined, variant: "error" });
    }
  };

  const handleSubmit = async () => {
    const body = validate();
    if (!body) return;
    try {
      const result = (await saveMutation.mutateAsync(body)) as Destination;
      await submitMutation.mutateAsync(result.id);
    } catch (e) {
      if (!saveMutation.isError) return;
      toast({ title: "Lưu thất bại", description: e instanceof Error ? e.message : undefined, variant: "error" });
    }
  };

  const applyTextTool = (tool: TextTransform, el: HTMLTextAreaElement) => {
    const { selectionStart: s, selectionEnd: e, value } = el;
    const out = tool.apply(value, s, e);
    setLongDesc(out.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(out.sel[0], out.sel[1]);
    });
  };

  const addKeyword = () => {
    const v = keywordInput.trim().toLowerCase();
    if (v && !keywords.includes(v)) setKeywords((prev) => [...prev, v]);
    setKeywordInput("");
  };

  const addImageUrl = () => {
    if (imageInput.trim()) {
      setImages((prev) => [...prev, imageInput.trim()]);
      setImageInput("");
    } else {
      // No URL typed → open the device file picker (the expected behaviour
      // of the "Thêm ảnh" button).
      fileInputRef.current?.click();
    }
  };

  const onDeviceFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = Math.max(0, 8 - images.length);
    if (remaining === 0) {
      toast({ title: "Đã đủ 8 ảnh", description: "Xóa bớt ảnh trước khi thêm.", variant: "error" });
      return;
    }
    const picked = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const next: string[] = [];
      for (const file of picked) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 12 * 1024 * 1024) {
          toast({ title: "Ảnh quá lớn", description: `${file.name} vượt quá 12MB.`, variant: "error" });
          continue;
        }
        next.push(await fileToResizedDataUrl(file));
      }
      if (next.length > 0) {
        setImages((prev) => Array.from(new Set([...prev, ...next])).slice(0, 8));
      }
    } catch (e) {
      toast({ title: "Đọc ảnh thất bại", description: e instanceof Error ? e.message : undefined, variant: "error" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const busy = saveMutation.isPending || submitMutation.isPending;

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-100">
      {/* Icon rail */}
      <aside className={classNames("hidden shrink-0 flex-col bg-white py-4 shadow-sm md:flex", collapsed ? "w-16 items-center px-2" : "w-52 px-3")}>
        <Link href="/" className="flex items-center gap-2 px-1">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 text-white">
            <MapPin className="size-4" />
          </span>
          {collapsed ? null : (
            <span className="text-base font-extrabold tracking-tight">
              <span className="text-slate-900">Viet</span>
              <span className="text-[#1d4ed8]">Journey</span>
            </span>
          )}
        </Link>
        <nav className="mt-6 w-full space-y-1 text-sm font-medium">
          <RailLink href="/studio" icon={<CalendarDays className="size-5" />} label="Tổng quan" collapsed={collapsed} />
          <RailLink href="/studio/enter" icon={<Pencil className="size-5" />} label="Nhập dữ liệu" collapsed={collapsed} active />
          <RailLink href="/studio/mine" icon={<User className="size-5" />} label="Dữ liệu của tôi" collapsed={collapsed} />
          <RailLink href="/me?tab=wishlist" icon={<Heart className="size-5" />} label="Yêu thích" collapsed={collapsed} />
          <RailLink
            href="/notifications"
            icon={<Bell className="size-5" />}
            label="Thông báo"
            collapsed={collapsed}
            badge={unreadCount > 0 ? String(Math.min(unreadCount, 9)) : undefined}
          />
          <span
            title="Sắp hỗ trợ"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400"
          >
            <HelpCircle className="size-5 shrink-0" />
            {collapsed ? null : "Hướng dẫn"}
          </span>
        </nav>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mt-auto flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition hover:bg-slate-100"
        >
          <span className={classNames("transition-transform", collapsed && "rotate-180")}>‹</span>
          {collapsed ? null : "Thu gọn"}
        </button>
      </aside>

      {/* Form column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-48 flex-1">
            <h1 className="truncate text-base font-black text-slate-900">
              Nhập dữ liệu điểm đến{provinceName ? ` – Tỉnh ${provinceName}` : ""}
            </h1>
            {savedAt ? (
              <Link
                href="/studio/mine"
                title="Mở danh sách dữ liệu đã lưu"
                className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
              >
                ✓ Đã lưu lúc {savedAt} — xem →
              </Link>
            ) : (
              <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-slate-400">
                ○ Chưa lưu
              </p>
            )}
          </div>
          <div className="hidden items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-1.5 xl:flex">
            <span className="grid size-9 place-items-center rounded-full bg-[#1d4ed8]/10 text-sm font-bold text-[#1d4ed8]">
              {(user.fullName ?? user.email).trim().charAt(0).toUpperCase()}
            </span>
            <span>
              <span className="block text-[13px] font-bold text-slate-900">{user.fullName}</span>
              <span className="block max-w-44 truncate text-xs text-slate-500">{user.email}</span>
            </span>
          </div>
          <ol className="hidden items-center md:flex" aria-label="Tiến trình duyệt">
            {STAGES.map((s, i) => {
              const n = i + 1;
              const done = stage > n;
              const current = stage === n;
              return (
                <li key={s.key} className="flex items-center">
                  <span className="flex flex-col items-center px-1">
                    <span
                      className={classNames(
                        "grid size-6 place-items-center rounded-full text-xs font-black text-white",
                        done || current
                          ? n === 1
                            ? "bg-[#1d4ed8]"
                            : n === 2
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          : "bg-slate-200 text-slate-500",
                      )}
                    >
                      {done ? "✓" : n}
                    </span>
                    <span className="mt-0.5 text-[10px] font-bold text-slate-600">{s.label}</span>
                    <span className="text-[9px] text-slate-400">{done ? "Đã duyệt" : s.sub}</span>
                  </span>
                  {i < STAGES.length - 1 ? <span className="mb-5 h-px w-6 bg-slate-200 sm:w-9" /> : null}
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-2">
            {savedId ? (
              <Link
                href={`/destinations/${savedId}`}
                className={buttonClass({ variant: "outline", size: "sm" })}
              >
                <Eye className="size-4" />
                Preview Public
              </Link>
            ) : null}
            <button type="button" onClick={handleSave} disabled={busy} className={buttonClass({ variant: "outline", size: "sm" })}>
              Lưu nháp
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className={buttonClass({ size: "sm" })}
            >
              <Send className="size-4" />
              Gửi duyệt Leader
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
              <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3">
                {(
                  [
                    { key: "basic", label: "1. Thông tin cơ bản" },
                    { key: "media", label: "2. Hình ảnh & Media" },
                    { key: "practical", label: "3. Thông tin thực tế" },
                    { key: "seo", label: "4. SEO & Phân loại" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={classNames(
                      "-mb-px shrink-0 border-b-2 px-3 py-3 text-[13px] font-semibold transition",
                      tab === t.key
                        ? "border-[#1d4ed8] text-[#1d4ed8]"
                        : "border-transparent text-slate-500 hover:text-slate-800",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4 p-4">
                {scoped && myProvinces != null && assigned.length === 0 ? (
                  <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-700 ring-1 ring-amber-200">
                    Bạn chưa được phân công tỉnh nào — mọi lần lưu sẽ bị từ chối. Liên hệ
                    giảng viên để được giao tỉnh trước khi nhập liệu.
                  </p>
                ) : null}
                {tab === "basic" ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Tên điểm đến" required error={errors.name}>
                        <input
                          value={name}
                          onChange={(e) => onName(e.target.value)}
                          placeholder="Vịnh Hạ Long"
                          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#1d4ed8]"
                        />
                      </Field>
                      <div>
                        <Label required error={errors.category}>Loại hình du lịch</Label>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {CATEGORY_CHIPS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => setCategory(category === c.value ? null : c.value)}
                              className={classNames(
                                "rounded-lg px-2.5 py-1.5 text-xs font-bold transition",
                                category === c.value
                                  ? "bg-[#1d4ed8] text-white shadow"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                              )}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Field label="Địa chỉ chi tiết" required error={errors.address}>
                      <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Thành phố Hạ Long, Tỉnh Quảng Ninh, Việt Nam"
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#1d4ed8]"
                      />
                    </Field>
                    <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                      <Field label="Vĩ độ (Latitude)" required error={errors.lat}>
                        <input
                          value={lat}
                          onChange={(e) => setLat(e.target.value)}
                          placeholder="20.9101"
                          inputMode="decimal"
                          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums outline-none focus:border-[#1d4ed8]"
                        />
                      </Field>
                      <Field label="Kinh độ (Longitude)" required error={errors.lng}>
                        <input
                          value={lng}
                          onChange={(e) => setLng(e.target.value)}
                          placeholder="107.1839"
                          inputMode="decimal"
                          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums outline-none focus:border-[#1d4ed8]"
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={() => {
                          setPickMode((v) => !v);
                          setMapOpen(true);
                        }}
                        className={buttonClass({
                          variant: pickMode ? "primary" : "outline",
                          size: "sm",
                          className: "h-10 whitespace-nowrap",
                        })}
                      >
                        <MapPin className="size-4" />
                        Chọn trên bản đồ
                      </button>
                    </div>
                    <Field label="Mô tả ngắn" required error={errors.shortDesc}>
                      <div className="relative">
                        <textarea
                          value={shortDesc}
                          onChange={(e) => setShortDesc(e.target.value.slice(0, 300))}
                          rows={3}
                          placeholder="Câu giới thiệu nổi bật của điểm đến…"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-[#1d4ed8]"
                        />
                        <span className="absolute bottom-2 right-2.5 text-[11px] tabular-nums text-slate-400">
                          {shortDesc.length}/300
                        </span>
                      </div>
                    </Field>
                    <Field label="Mô tả chi tiết" required error={errors.longDesc}>
                      <div className="overflow-hidden rounded-lg border border-slate-200 focus-within:border-[#1d4ed8]">
                        <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
                          {TEXT_TOOLS.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              title={b.title}
                              onClick={() => {
                                const el = longRef.current;
                                if (el) applyTextTool(b, el);
                              }}
                              className="grid size-7 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-900 hover:shadow-sm"
                            >
                              {b.icon}
                            </button>
                          ))}
                        </div>
                        <textarea
                          ref={longRef}
                          value={longDesc}
                          onChange={(e) => setLongDesc(e.target.value)}
                          rows={8}
                          placeholder="Lịch sử, trải nghiệm, thời điểm lý tưởng… (hỗ trợ cú pháp Markdown)"
                          className="w-full px-3 py-2.5 text-sm leading-relaxed outline-none"
                        />
                      </div>
                    </Field>
                    <div>
                      <Label>Gợi ý từ khóa</Label>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {keywords.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setKeywords((prev) => prev.filter((x) => x !== k))}
                            title="Xóa từ khóa"
                            className="group flex items-center gap-1 rounded-lg bg-[#1d4ed8]/10 px-2.5 py-1.5 text-xs font-semibold text-[#1d4ed8] transition hover:bg-[#1d4ed8]/20"
                          >
                            {k}
                            <X className="size-3 opacity-50 group-hover:opacity-100" />
                          </button>
                        ))}
                        <span className="flex items-center gap-1">
                          <input
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addKeyword();
                              }
                            }}
                            placeholder="Thêm từ khóa"
                            className="h-8 w-32 rounded-lg border border-dashed border-slate-300 px-2 text-xs outline-none focus:border-[#1d4ed8]"
                          />
                          <button
                            type="button"
                            onClick={addKeyword}
                            aria-label="Thêm từ khóa"
                            className="grid size-8 place-items-center rounded-lg text-[#1d4ed8] transition hover:bg-[#1d4ed8]/10"
                          >
                            <Plus className="size-4" />
                          </button>
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}

                {tab === "media" ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={imageInput}
                        onChange={(e) => setImageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addImageUrl();
                          }
                        }}
                        placeholder="Dán URL hình ảnh rồi Enter…"
                        className="h-10 min-w-52 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#1d4ed8]"
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => onDeviceFiles(e.target.files)}
                      />
                      <button
                        type="button"
                        onClick={addImageUrl}
                        disabled={uploading}
                        title={imageInput.trim() ? "Thêm URL đã dán" : "Chọn ảnh từ thiết bị"}
                        className={buttonClass({ variant: "outline", size: "sm", className: "h-10" })}
                      >
                        <ImagePlus className="size-4" />
                        {uploading ? "Đang đọc…" : "Thêm ảnh"}
                      </button>
                      <button
                        type="button"
                        onClick={() => resolveMutation.mutate()}
                        disabled={resolveMutation.isPending}
                        title="Tự động tìm ảnh Wikipedia cho điểm đến này"
                        className={buttonClass({ variant: "outline", size: "sm", className: "h-10" })}
                      >
                        <Sparkles className="size-4" />
                        {resolveMutation.isPending ? "Đang tìm…" : "Tự động tìm ảnh"}
                      </button>
                    </div>
                    {images.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                        Chưa có hình ảnh. Bấm “Thêm ảnh” để chọn từ thiết bị, dán URL, hoặc dùng tìm ảnh tự động.
                      </p>
                    ) : (
                      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {images.map((src, i) => (
                          <li key={`${i}-${src.slice(0, 32)}`} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setImages((prev) => prev.filter((x) => x !== src))}
                              aria-label="Xóa ảnh"
                              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
                            >
                              <X className="size-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}

                {tab === "practical" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Giờ mở cửa">
                      <input
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        placeholder="7:00 – 17:30 hàng ngày"
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#1d4ed8]"
                      />
                    </Field>
                    <Field label="Giá vé (VND)">
                      <input
                        value={ticket}
                        onChange={(e) => setTicket(e.target.value.replace(/[^\d]/g, ""))}
                        placeholder="0 = miễn phí"
                        inputMode="numeric"
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums outline-none focus:border-[#1d4ed8]"
                      />
                    </Field>
                  </div>
                ) : null}

                {tab === "seo" ? (
                  <div className="space-y-4">
                    <Field label="Slug (đường dẫn)" error={errors.slug}>
                      <input
                        value={slug}
                        onChange={(e) => {
                          setSlug(slugify(e.target.value));
                          setSlugTouched(true);
                        }}
                        placeholder="vinh-ha-long"
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm outline-none focus:border-[#1d4ed8]"
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        Tự tạo từ tên điểm đến. Phải là duy nhất, ví dụ: /destinations/{slug || "…"}
                      </p>
                    </Field>
                    <Field label="Tỉnh / Thành phố *" error={errors.province}>
                      <select
                        value={effectiveProvinceId}
                        onChange={(e) => setProvinceId(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-[#1d4ed8]"
                      >
                        <option value="">— Chưa chọn —</option>
                        {provinceOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-400">
                        {assigned.length > 0
                          ? `Chỉ hiện ${assigned.length} tỉnh bạn được phân công — máy chủ cũng kiểm tra lại khi lưu.`
                          : "Máy chủ chỉ chấp nhận tỉnh bạn được phân công."}
                      </p>
                    </Field>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5">
              {savedAt ? (
                <Link
                  href="/studio/mine"
                  title="Mở danh sách dữ liệu đã lưu"
                  className="mr-auto flex items-center gap-1.5 text-[13px] font-bold text-emerald-600 hover:underline"
                >
                  ✓ Đã lưu — xem dữ liệu →
                </Link>
              ) : (
                <p className="mr-auto flex items-center gap-1.5 text-[13px] font-bold text-slate-400">
                  ○ Chưa lưu
                </p>
              )}
              <Link href="/studio/mine" className={buttonClass({ variant: "outline" })}>
                <Database className="size-4" />
                Dữ liệu đã lưu
              </Link>
              <button type="button" onClick={() => router.back()} className={buttonClass({ variant: "outline" })}>
                Hủy bỏ
              </button>
              <button type="button" onClick={handleSave} disabled={busy} className={buttonClass({ variant: "outline" })}>
                Lưu nháp
              </button>
              <button type="button" onClick={handleSubmit} disabled={busy} className={buttonClass()}>
                <Send className="size-4" />
                {busy ? "Đang xử lý…" : "Gửi duyệt Leader"}
              </button>
            </div>
          </div>

          {mapOpen ? (
            <div className="relative hidden w-[380px] shrink-0 border-l border-slate-200 xl:block 2xl:w-[440px]">
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                title="Ẩn bản đồ"
                className="absolute -left-3.5 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white text-xs font-bold text-slate-500 shadow-lg ring-1 ring-slate-200 transition hover:text-slate-900"
              >
                ‹ ›
              </button>
              <div className="h-full">
                <EntryMap
                  lat={coordsValid ? latNum : null}
                  lng={coordsValid ? lngNum : null}
                  name={name}
                  statusLabel={status === "PUBLISHED" ? "Đã duyệt" : status === "DRAFT" ? "Bản nháp" : "Chờ duyệt"}
                  pickMode={pickMode}
                  onPick={(nextLng, nextLat) => onPick(nextLng, nextLat)}
                  showSurrounding={showSurrounding}
                  onToggleSurrounding={() => setShowSurrounding((v) => !v)}
                  surrounding={surrounding.data ?? []}
                  onSelectPlace={(p) => {
                    // Address always; name only when the student hasn't
                    // typed one yet — never overwrite their input.
                    setAddress(p.address);
                    if (!name.trim()) {
                      setName(p.name);
                      if (!slugTouched) setSlug(slugify(p.name));
                    }
                    setErrors((prev) => {
                      if (!prev.address && !prev.lat && !prev.lng) return prev;
                      const next = { ...prev };
                      delete next.address;
                      delete next.lat;
                      delete next.lng;
                      return next;
                    });
                  }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="hidden w-10 shrink-0 flex-col items-center gap-2 border-l border-slate-200 bg-white py-4 text-xs font-bold text-slate-500 transition hover:text-slate-900 xl:flex"
            >
              <MapPin className="size-4" />
              <span className="[writing-mode:vertical-lr]">Hiện bản đồ</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RailLink({
  href,
  icon,
  label,
  collapsed,
  active = false,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  active?: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={classNames(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
        active ? "bg-[#1d4ed8]/10 font-bold text-[#1d4ed8]" : "text-slate-600 hover:bg-slate-100",
      )}
      title={collapsed ? label : undefined}
    >
      <span className="relative shrink-0">
        {icon}
        {badge ? (
          <span className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </span>
      {collapsed ? null : label}
    </Link>
  );
}

function Label({
  children,
  required,
  error,
}: {
  children: React.ReactNode;
  required?: boolean;
  error?: string;
}) {
  return (
    <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">
      {children} {required ? <span className="text-rose-500">*</span> : null}
      {error ? <span className="ml-2 font-normal text-rose-500">{error}</span> : null}
    </span>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <Label required={required} error={error}>
        {label}
      </Label>
      {children}
    </label>
  );
}

function readKeywords(openingHours: unknown): string[] {
  if (openingHours && typeof openingHours === "object" && Array.isArray((openingHours as { keywords?: unknown }).keywords)) {
    return (openingHours as { keywords: string[] }).keywords.filter((k) => typeof k === "string");
  }
  return [];
}

function readHours(openingHours: unknown): string {
  if (openingHours && typeof openingHours === "object") {
    const h = (openingHours as { hours?: unknown }).hours;
    return typeof h === "string" ? h : "";
  }
  return typeof openingHours === "string" ? openingHours : "";
}

/**
 * Read a device image file and downscale it client-side so it can be stored
 * inline (no upload API exists yet). Caps the long edge at 1600px and encodes
 * JPEG q0.82 — keeps a phone photo under ~500KB instead of several MB of
 * base64 in the destination record.
 */
function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1600;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Trình duyệt không hỗ trợ xử lý ảnh"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Không đọc được ${file.name}`));
    };
    img.src = url;
  });
}
