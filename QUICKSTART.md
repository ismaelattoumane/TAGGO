# 🚀 TAGGO — Quick Start Guide

**TL;DR**: Clone → Install → Run → Login → Go!

---

## 30 Seconds to Demo

```bash
# 1. Install dependencies (one time)
npm install

# 2. Start development server
npm run dev

# 3. Open browser to http://localhost:5173
# 4. Click "Compte démo" button
# ✨ You're in!
```

---

## What You Can Do Now

✅ **Create QR Codes**  
Add a name + destination URL → auto-generated public ID  

✅ **Edit QR Codes**  
Change title, URL, status anytime  

✅ **View Dashboard**  
See all your QR codes + stats  

✅ **Public QR Pages**  
Visit `/qr/TGG-8K9L2R` without login  

✅ **Test Authentication**  
Create accounts, login, logout  

---

## Demo Accounts (Pre-Created)

| Account | Password | Purpose |
|---------|----------|---------|
| `demo@taggo.local` | `DemoPass123!` | Main demo account |
| `test@taggo.local` | `TestPass123!` | Secondary test account |

**Or create your own account** on the signup page.

---

## Project Structure

```
TAGGO/
├── src/                    # React app
│   ├── pages/             # 7 pages (login, dashboard, QR detail, etc)
│   ├── context/           # Auth management
│   ├── lib/               # Utilities (validators, demo data)
│   └── services/          # QR logic
├── docs/                  # Documentation
│   ├── DEMO.md           # Full testing guide
│   ├── STATUS.md         # Project status
│   ├── ROADMAP.md        # Development phases
│   └── ARCHITECTURE.md   # Technical details
├── package.json           # Dependencies
└── README.md             # Full guide
```

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/context/AuthContext.tsx` | Authentication (Supabase + fallback) |
| `src/lib/demoData.ts` | QR storage & CRUD |
| `src/lib/demoAuth.ts` | Local auth when Supabase unavailable |
| `src/pages/DashboardPage.tsx` | Main dashboard |
| `supabase/schema.sql` | Database schema (for production) |

---

## Common Tasks

### Create a QR Code
1. Click "Créer un QR" button
2. Enter name + URL
3. Click "Créer le QR"
4. See it in dashboard immediately

### Edit a QR Code
1. Click "Ouvrir" on any QR in dashboard
2. Edit fields (name, URL, status)
3. Click "Enregistrer"
4. Auto-saved ✓

### Access Public QR Page
1. Visit: `http://localhost:5173/qr/TGG-8K9L2R`
2. No login needed
3. Shows QR details + destination link

### Clear All Demo Data
Open browser DevTools (F12) and run:
```javascript
localStorage.clear()
```

---

## Important Notes

⚠️ **This is demo mode** — data stored in browser  
✅ **Supabase-ready** — just add credentials to use real database  
✅ **Production code** — no hacks or workarounds

---

## Documentation Quick Links

| Need | Read |
|------|------|
| How to test everything | [DEMO.md](docs/DEMO.md) |
| Project status & tasks | [STATUS.md](docs/STATUS.md) |
| Development phases | [ROADMAP.md](docs/ROADMAP.md) |
| Technical architecture | [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| All accomplishments | [ACCOMPLISHMENTS.md](docs/ACCOMPLISHMENTS.md) |

---

## Development Commands

```bash
npm run dev          # Start development server with hot reload
npm test             # Run tests in watch mode
npm test -- --run    # Run tests once
npm run build        # Create production build
npm run preview      # Preview production build locally
npm run lint         # Check code quality
```

---

## Troubleshooting

**Q: Login doesn't work?**  
→ Make sure you use exact email: `demo@taggo.local`

**Q: Data disappeared?**  
→ Don't use browser incognito mode (disables localStorage)

**Q: Port 5173 already in use?**  
→ Vite will automatically try port 5174

**Q: Tests failing?**  
→ Run `npm install` first to ensure all dependencies

---

## Moving to Production

When ready to use with real backend:

```bash
# 1. Create Supabase project at https://supabase.com
# 2. Copy your credentials
# 3. Create .env.local file:

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# 4. Run database setup in Supabase (use supabase/schema.sql)
# 5. Restart app

npm run dev
# App now uses real Supabase instead of localStorage ✓
```

---

## Project Status

```
✅ Authentication    Complete (local + Supabase-ready)
✅ QR Management     Complete (full CRUD)
✅ UI/UX             Complete (7 pages, fully connected)
✅ Validation        Complete (all forms)
✅ Testing           Complete (8 tests passing)
✅ Documentation     Complete (5 doc files)
🔄 Supabase Backend  Awaiting credentials
🔄 Production Deploy Awaiting approval
```

---

## Next Steps

1. ✅ Test the app with demo account
2. ✅ Create your own test account
3. ✅ Create some QR codes
4. ✅ Visit public QR pages
5. 📋 Get Supabase credentials (when ready)
6. 🚀 Deploy to production (when approved)

---

## Questions?

- Full guide: See [README.md](README.md)
- Detailed docs: Check [docs/](docs/) folder
- Issues: All documented in [STATUS.md](docs/STATUS.md)

---

**Happy Testing! 🎉**

*For the complete experience, spend 5 minutes with [DEMO.md](docs/DEMO.md)*
