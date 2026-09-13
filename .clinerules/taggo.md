# TAGGO — GLOBAL DEVELOPMENT RULES

You are building TAGGO, a premium connected T-shirt platform.

TAGGO combines:
- physical T-shirts
- QR codes
- public digital profiles
- user dashboards
- customization
- social links
- connected experiences

The product must feel:
- premium
- modern
- minimal
- technological
- French
- trustworthy
- simple
- fast

Never build generic SaaS interfaces.

Every design decision must reinforce the TAGGO identity.

---

# TECH STACK
Production frontend:
- Vite + React is currently accepted for the MVP.
- Next.js may be adopted later if SEO, SSR, routing, performance or architecture justify the migration.

Never migrate frameworks solely because the preferred stack document mentions another framework.
Evaluate migration cost vs measurable product benefits first.

Frontend:
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

3D:
- Three.js
- React Three Fiber
- Drei

Animation:
- GSAP and/or Motion
- Lenis where appropriate

Backend:
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- RLS

Deployment:
- Vercel
- Supabase
- Cloudflare DNS

---

# DEVELOPMENT PRINCIPLES

1. TypeScript strict mode.
2. No unnecessary dependencies.
3. Reusable components.
4. Accessible HTML.
5. Responsive by default.
6. Mobile-first.
7. Performance-first.
8. Security-first.
9. SEO-first.
10. No hardcoded secrets.
11. No duplicated logic.
12. No fake backend implementations in production code.
13. No TODOs for critical functionality.
14. Do not silently invent product requirements.
15. If a requirement is unclear, inspect the existing project, Figma and documentation before implementing.

---

# DESIGN

Create a TAGGO design system before implementing the full application.

Define:
- colors
- typography
- spacing
- radius
- shadows
- borders
- buttons
- inputs
- cards
- modals
- navigation
- tables
- badges
- alerts
- loaders
- empty states
- error states

Do not use random colors.

Use the TAGGO palette consistently.

---

# LANDING PAGE

The landing page must feel like a premium product launch.

The 3D T-shirt is the visual centerpiece.

Implement:
- scroll storytelling
- 3D T-shirt rotation
- camera movement
- QR reveal
- section transitions
- progressive storytelling
- subtle parallax
- smooth motion
- responsive behavior

Animations must have a purpose.

Avoid excessive animations.

Respect prefers-reduced-motion.

---

# 3D

The 3D T-shirt must not destroy performance.

Use:
- lazy loading
- optimized GLB
- compressed textures
- dynamic imports
- mobile optimization
- fallback rendering

Never block initial page rendering while loading the 3D experience.

---

# SECURITY

Never expose:
- Supabase service role key
- private API keys
- secrets
- authentication tokens

Use:
- environment variables
- RLS
- server-side authorization
- validation
- rate limiting
- secure authentication
- secure headers
- CSP
- upload validation

Security must be reviewed before production.

---

# SEO

Implement:
- metadata
- Open Graph
- sitemap
- robots.txt
- canonical URLs
- JSON-LD
- semantic HTML
- optimized images
- correct heading hierarchy
- fast loading
- clean URLs

---

# ACCESSIBILITY

Target WCAG AA.

Ensure:
- keyboard navigation
- focus states
- labels
- contrast
- semantic HTML
- screen-reader compatibility
- reduced motion

---

# TESTING

Before considering a feature complete:

- TypeScript passes
- lint passes
- build passes
- tests pass
- responsive behavior verified
- accessibility checked
- security checked
- performance checked

Never claim a feature is complete without verification.

---

# GIT

Use small logical commits.

Commit format:

feat:
fix:
refactor:
perf:
security:
docs:
test:
chore:

Never commit:
- .env
- secrets
- API keys
- generated credentials
- node_modules

---

# IMPORTANT

Do not rush.

First inspect:
1. repository
2. Figma
3. existing documentation
4. architecture
5. dependencies

Then create an implementation plan.

Do not immediately start writing hundreds of files.

Build the foundation first.