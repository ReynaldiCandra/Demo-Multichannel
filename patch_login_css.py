import sys

path = "src/app/globals.css"
with open(path, "r", encoding="utf-8") as f:
    css = f.read()

replacements = [
    (
        ".login-shell { position: relative; min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 460px); gap: 20px; align-items: stretch; padding: 20px; background: hsl(222 48% 11%); }",
        ".login-shell { position: relative; min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 460px); gap: 20px; align-items: stretch; padding: 20px; border-radius: 26px; overflow: hidden; background-image: url('/branding/login-bg.png'); background-size: cover; background-position: center; }\n.login-shell::before { content: ''; position: absolute; inset: 0; z-index: 0; background: linear-gradient(100deg, hsl(222 48% 8% / .6) 0%, hsl(222 48% 8% / .25) 45%, hsl(222 48% 8% / .08) 68%); pointer-events: none; }"
    ),
    (
        ".login-visual { position: relative; overflow: hidden; border-radius: 22px; padding: 36px; display: flex; flex-direction: column; justify-content: space-between; background-image: url('/branding/login-bg.png'); background-size: cover; background-position: center; color: hsl(0 0% 100%); }",
        ".login-visual { position: relative; z-index: 1; padding: 36px; display: flex; flex-direction: column; justify-content: space-between; color: hsl(0 0% 100%); }"
    ),
    (
        ".login-visual::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, hsl(222 48% 10% / .1) 0%, hsl(222 48% 8% / .35) 55%, hsl(222 48% 6% / .8) 100%); pointer-events: none; }\n",
        ""
    ),
    (
        ".login-card { position: relative; z-index: 1; width: 100%; background: hsl(0 0% 100% / .94); border: 1px solid hsl(220 25% 90%); backdrop-filter: blur(24px) saturate(160%); -webkit-backdrop-filter: blur(24px) saturate(160%); border-radius: 20px; box-shadow: 0 28px 70px hsl(222 45% 8% / .25); padding: 36px 32px; color: hsl(222 47% 15%); display: flex; flex-direction: column; justify-content: center; }",
        ".login-card { position: relative; z-index: 1; width: 100%; background: hsl(0 0% 100% / .5); border: 1px solid hsl(0 0% 100% / .55); backdrop-filter: blur(28px) saturate(170%); -webkit-backdrop-filter: blur(28px) saturate(170%); border-radius: 20px; box-shadow: 0 28px 70px hsl(222 45% 8% / .35), inset 0 1px 0 hsl(0 0% 100% / .5); padding: 36px 32px; color: hsl(222 47% 15%); display: flex; flex-direction: column; justify-content: center; }"
    ),
    (
        "  .login-shell { grid-template-columns: 1fr; padding: 0; gap: 0; background: hsl(0 0% 100%); }\n  .login-visual { border-radius: 0; padding: 26px 22px; min-height: 40vh; justify-content: flex-start; }\n  .login-visual-copy, .login-visual-topbar { display: none; }\n  .login-card { position: relative; z-index: 5; border-radius: 26px 26px 0 0; margin-top: -32px; box-shadow: 0 -14px 40px hsl(222 45% 8% / .3); padding: 30px 22px 32px; }\n  .login-brand { display: none; }",
        "  .login-shell { grid-template-columns: 1fr; padding: 14px; gap: 0; border-radius: 22px; }\n  .login-visual { padding: 22px 20px 0; min-height: auto; justify-content: flex-start; }\n  .login-visual-copy, .login-visual-topbar { display: none; }\n  .login-card { position: relative; z-index: 2; margin-top: 22px; border-radius: 20px; box-shadow: 0 20px 50px hsl(222 45% 8% / .35); padding: 28px 22px 30px; }\n  .login-brand { display: none; }"
    ),
]

ok = True
for i, (old, new) in enumerate(replacements, start=1):
    if old not in css:
        print(f"[GAGAL] Pola #{i} tidak ketemu persis di file kamu — perlu edit manual.")
        ok = False
        continue
    css = css.replace(old, new, 1)
    print(f"[OK] Pola #{i} berhasil diganti.")

with open(path, "w", encoding="utf-8") as f:
    f.write(css)

if ok:
    print("\nSelesai — semua 5 perubahan berhasil diterapkan ke", path)
else:
    print("\nSebagian berhasil, sebagian perlu dicek manual (lihat pesan GAGAL di atas).")