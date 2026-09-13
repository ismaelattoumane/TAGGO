# TAGGO Code Lifecycle

## Cycle commercial

```text
AVAILABLE
  -> RESERVED
  -> ASSIGNED
  -> ACTIVATED
  -> ACTIVE
```

`CANCELLED`, `INACTIVE` et `REPLACED` couvrent les sorties opérationnelles sans remplacer le `status` historique du MVP. Le champ `qr_codes.lifecycle_status` porte le cycle commercial ; `qr_codes.status` reste compatible avec le dashboard actuel.

Les TAGGO commerciaux sont créés côté serveur par `provision_taggo_stock`, avec un `public_id` aléatoire au format `TGG-XXXXXXX`. L'utilisateur ne peut ni choisir ni générer un code commercial depuis le frontend.

## Activation

1. Le client scanne `/t/TGG-XXXXXXX`.
2. Un code existant mais non activé affiche un état générique et le bouton `Activer mon TAGGO`.
3. Le client se connecte ou crée son compte.
4. `activate_taggo` vérifie côté base que le code est attribué à ce compte.
5. L'opération atomique renseigne `owner_id` et passe le lifecycle à `active`.

Un code inexistant, annulé, remplacé ou attribué à un autre compte ne révèle aucune donnée privée et ne peut pas être activé.

## Future intégration boutique

La boutique pourra appeler les fonctions serveur avec une référence de commande externe :

```text
reserve_taggo_for_order(external_order_id, external_product_id)
  -> code AVAILABLE verrouillé et RESERVED
assign_taggo_to_customer(external_order_id, user_id)
  -> code ASSIGNED
```

`external_order_id` est unique et l'opération de réservation verrouille le code avec `FOR UPDATE SKIP LOCKED`. Un second appel pour la même commande retourne la même attribution au lieu de créer un second TAGGO.

Ces fonctions sont réservées au rôle serveur. Aucun secret `service_role` n'est exposé au frontend. La boutique, le paiement et la livraison ne font pas partie de cette étape.
