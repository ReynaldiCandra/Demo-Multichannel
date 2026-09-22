export type ModuleVisibility = {
  key: string;
  isEnabled: boolean;
};

/**
 * Sidebar tetap tampil penuh sebelum daftar modul berhasil dimuat. Ini mencegah
 * flash menu kosong ketika API sedang loading atau database belum di-seed.
 */
export function isModuleVisible(
  moduleKey: string | undefined,
  modules: ModuleVisibility[] | undefined,
  loaded: boolean,
) {
  if (!moduleKey || !loaded || !modules?.length) return true;
  return modules.some((module) => module.key === moduleKey && module.isEnabled);
}