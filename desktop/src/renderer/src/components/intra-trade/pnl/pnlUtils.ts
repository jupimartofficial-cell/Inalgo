export const DATE_RANGE_PRESETS = ['DAY', 'WEEK', 'MONTH', 'CUSTOM'] as const;
export type DatePreset = (typeof DATE_RANGE_PRESETS)[number];

const toIso = (date: Date) => date.toISOString().slice(0, 10);

export const dateRangeFromPreset = (preset: DatePreset): { fromDate?: string; toDate?: string } => {
  const now = new Date();
  if (preset === 'CUSTOM') return {};
  if (preset === 'DAY') return { fromDate: toIso(now), toDate: toIso(now) };
  if (preset === 'WEEK') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { fromDate: toIso(d), toDate: toIso(now) };
  }
  const m = new Date(now);
  m.setDate(m.getDate() - 29);
  return { fromDate: toIso(m), toDate: toIso(now) };
};

export const fmtPrice = (v: number | null | undefined) =>
  v == null ? '—' : '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pnlColor = (v: number | null | undefined) =>
  v == null ? 'text.primary' : v > 0 ? '#15803d' : v < 0 ? '#b91c1c' : 'text.secondary';

export const pnlBg = (v: number | null | undefined) =>
  v == null || v === 0 ? undefined : v > 0 ? '#f0fdf4' : '#fef2f2';

export const fmtDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y?.slice(2)}`;
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
