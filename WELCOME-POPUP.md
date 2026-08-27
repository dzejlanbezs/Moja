# Welcome bonus popup

Popup koji se sam otvori kad neko dodje na virtusjack.com: pulsirajuci logo,
**100% Sports Bonus**, **No Wager Requirement**, **Up to $1,000** i uslov da se
igra **Single na kvotu 1.50x – 5.00x**.

## Fajlovi

| Fajl | Sta je |
| --- | --- |
| `assets/css/welcome-popup.css` | Ceo stil popupa |
| `assets/js/welcome-popup.js` | Otvaranje, zatvaranje i pamcenje da je vidjen |
| `welcome-popup.html` | HTML blok koji se zalepi u sajt |
| `welcome-popup-demo.html` | Probna strana, otvori je u browseru da vidis kako izgleda |

## Kako se dodaje

1. Kopiraj `assets/css/welcome-popup.css` i `assets/js/welcome-popup.js` u svoj
   `assets` folder.
2. U `<head>` svog `index.html` dodaj:

   ```html
   <link rel="stylesheet" href="assets/css/welcome-popup.css">
   ```

3. Sadrzaj fajla `welcome-popup.html` zalepi u `index.html` neposredno pre
   `</body>`, i ispod njega dodaj:

   ```html
   <script src="assets/js/welcome-popup.js"></script>
   ```

CSS koristi tvoje postojece promenljive iz `app.css` (`--gold`, `--surface`,
`--text-2` i ostale), a ima i rezervne vrednosti, pa radi i sam za sebe.

## Podesavanja

Sve ide preko `data-` atributa na `<div class="vj-pop" id="vjWelcomePopup">`:

| Atribut | Podrazumevano | Sta radi |
| --- | --- | --- |
| `data-delay` | `700` | Koliko ms posle ucitavanja strane da se pojavi |
| `data-repeat` | `24` | Posle koliko sati sme opet. `0` = svaki put, `never` = samo jednom |
| `data-claim-url` | `#register` | Gde vodi zlatno dugme. Ostavi prazno (`""`) da nikuda ne vodi |
| `data-auto` | — | Stavi `false` ako ne zelis automatsko otvaranje |

## Iz koda

```js
VJWelcomePopup.open();    // otvori odmah
VJWelcomePopup.close();   // zatvori i zapamti
VJWelcomePopup.reset();   // obrisi pamcenje, pa se sledeci put opet pojavi
```

Dugme **Claim Bonus** salje event `vj:welcome-claim` pre nego sto odvede na
`data-claim-url`. Ako hoces da umesto toga otvoris svoj register modal:

```js
document.addEventListener('vj:welcome-claim', (e) => {
  e.preventDefault();           // zaustavi skok na data-claim-url
  document.querySelector('[data-auth="register"]').click();
});
```

## Menjanje teksta

Sve je obican HTML u `welcome-popup.html`:

- naslov — `<h2 class="vj-pop-title">100% Sports Bonus</h2>`
- iznos — `<div class="vj-pop-amount">` (`Up to` i `$1,000`)
- kvote i tip tiketa — dva `<div class="vj-pop-row">` bloka
- svoj logo — u `<div class="vj-pop-logo">` zameni `<svg>` sa
  `<img src="assets/img/logo/mark.png" alt="Virtusjack">`, pulsiranje ostaje

Popup se zatvara na X, na **Maybe later**, klikom na zamucenu pozadinu i na
`Esc`. Na telefonu se sam smanji, a ako korisnik u sistemu ima ugasene
animacije, pulsiranje se ne pusta.
