-- ===========================================================================
-- Étape 13.1 — Exposition publique d'un TAGGO (F2)
--
-- Constat (audit étape 13, test réel avec le rôle `anon`) :
--
--   F2  La policy « Public can view active QR codes » porte sur la TABLE
--       `public.qr_codes`. Une RLS filtre des LIGNES, jamais des COLONNES :
--       `select *` renvoyait donc à l'anonyme les 14 colonnes du TAGGO,
--       `owner_id` compris — l'identifiant du propriétaire. L'interface
--       n'affichait jamais ce champ, mais il était présent dans la réponse
--       réseau, et l'identifiant était donc exposé publiquement.
--
-- Correction : la RLS ne peut pas faire ce travail, on ne lui demande pas de le
-- faire. La lecture publique passe par une VUE à colonnes explicites. Elle ne
-- peut donc pas exposer `owner_id`, ni aucun horodatage de cycle de vie, ni
-- aucune référence de paiement ou d'abonnement, parce que ces colonnes ne sont
-- tout simplement pas projetées.
--
--   * `anon` perd tout accès à la table `qr_codes` : il ne connaît plus que la
--     vue, dont les colonnes sont une liste blanche.
--   * La policy publique sur la table est retirée : un utilisateur CONNECTÉ ne
--     peut plus non plus lire `owner_id` d'un TAGGO public via la table. Il
--     conserve l'accès à ses propres TAGGO, ce qui est le seul usage légitime.
--
-- La vue n'est PAS `security_invoker` : elle s'exécute avec les droits de son
-- propriétaire et impose elle-même son propre prédicat, qui reproduit à
-- l'identique l'ancien prédicat de la policy (public + actif + destination +
-- période non échue). C'est ce qui permet à `anon` de l'interroger malgré
-- l'absence de droit sur la table.
-- ===========================================================================

create or replace view public.public_taggo_cards as
select
  q.id,
  q.public_id,
  q.title,
  q.destination_url,
  q.status
from public.qr_codes q
where q.is_public = true
  and q.status = 'active'
  and q.destination_url is not null
  and public.taggo_subscription_allows_public(q.id);

comment on view public.public_taggo_cards is
  'Projection publique d''un TAGGO : liste blanche de colonnes, sans owner_id, '
  'sans horodatage de cycle de vie et sans référence de paiement ou d''abonnement.';

-- `anon` n'a plus aucun droit sur la table ; la vue est son unique point
-- d'entrée public.
revoke all on public.public_taggo_cards from public;
grant  select on public.public_taggo_cards to anon, authenticated;

revoke select on public.qr_codes from anon;

-- Retrait de la policy publique : plus aucune ligne de `qr_codes` n'est lisible
-- par quelqu'un qui n'en est pas le propriétaire. La page publique passe par la
-- vue, et `get_public_taggo_state` reste un RPC `security definer` qui lit la
-- table sans être soumis à la RLS.
drop policy if exists "Public can view active QR codes" on public.qr_codes;
