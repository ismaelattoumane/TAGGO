-- Les clients authentifiés peuvent lire leurs propres scans via RLS,
-- mais ne doivent ni vider la table ni y créer des triggers.
REVOKE TRUNCATE, TRIGGER, REFERENCES
ON TABLE public.taggo_scans
FROM anon, authenticated;
