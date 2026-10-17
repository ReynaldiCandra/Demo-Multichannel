'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Target } from 'lucide-react';
import { Button, Field, Panel, PageTitle } from '@/components/ui';
import {
  useProfitSettings,
  useUpdateProfitSettings,
} from '@/lib/api/hooks';
import { money } from '@/lib/format';

/**
 * Pengaturan → Profit & Target.
 *
 * Default target profit/pcs dipakai kalkulator & badge saat target produk
 * dikosongkan (Rp50.000 default); margin keamanan adalah buffer % yang
 * melebarkan harga jual minimum untuk fluktuasi biaya supplier/marketplace.
 */
export default function ProfitSettingsPage() {
  const settings = useProfitSettings();
  const save = useUpdateProfitSettings();

  const [target, setTarget] = useState('');
  const [safety, setSafety] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (settings.data && !hydrated) {
      setTarget(String(settings.data.defaultTargetProfitPcs));
      setSafety(String(settings.data.safetyMarginPercent));
      setHydrated(true);
    }
  }, [settings.data, hydrated]);

  const dirty =
    Number(target) !== (settings.data?.defaultTargetProfitPcs ?? 0) ||
    Number(safety) !== (settings.data?.safetyMarginPercent ?? 0);

  return (
    <>
      <Link href="/pengaturan" className="back-link">
        <ChevronLeft size={14} /> Pengaturan
      </Link>
      <PageTitle
        eyebrow="PENGATURAN / PROFIT & TARGET"
        title="Angka keuntungan Anda."
        description="Default target profit dipakai semua produk yang targetnya dikosongkan. Margin keamanan adalah buffer harga minimum untuk fluktuasi biaya."
      />

      <Panel className="settings-card profit-settings-card">
        <div className="settings-card-head">
          <span className="settings-symbol">
            <Target size={18} />
          </span>
          <div className="settings-card-text">
            <h2 className="settings-card-title">Pengaturan Profit &amp; Target</h2>
            <p className="settings-card-desc">
              Kalkulator di form produk dan badge di Input Harian mengikuti angka di sini.
            </p>
          </div>
        </div>

        <div className="settings-form-grid">
          <Field
            label="Default target profit per pcs (global)"
            hint={`Dipakai saat target profit produk dikosongkan. Saat ini: ${money(settings.data?.defaultTargetProfitPcs ?? 50000)}.`}
          >
            <input
              type="number"
              min="0"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              data-testid="input-default-target-profit"
            />
          </Field>
          <Field
            label="Margin keamanan (%)"
            hint="Buffer harga minimum, mis. 5% untuk jaga-jaga fee/supplier naik. Disarankan 0–10%."
          >
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={safety}
              onChange={(event) => setSafety(event.target.value)}
              data-testid="input-safety-margin"
            />
          </Field>
        </div>

        <div className="form-actions">
          <Button
            disabled={!dirty || save.isPending}
            onClick={() =>
              save.mutate({
                data: {
                  defaultTargetProfitPcs: Number(target) || 0,
                  safetyMarginPercent: Number(safety) || 0,
                },
              })
            }
            data-testid="button-save-profit-settings"
          >
            {save.isPending ? 'Menyimpan…' : 'Simpan perubahan'}
          </Button>
        </div>
      </Panel>
    </>
  );
}
