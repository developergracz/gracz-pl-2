# Gracz.pl V3 — PL-C12 Ochrona małoletnich / minors

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Control ID: `PL-C12`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — HOLD / VERSIONED / FREEZE-SAFE**  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E05`, `PL-E09`, `PL-E11`, `PL-E13`, `PL-E16`  
Decision Owner: **Czesław Socha — Privacy/Legal Decision Owner Gracz.pl**

> Ten dokument ocenia kontrolę ochrony małoletnich w modelu Gracz.pl V3. Jest artefaktem governance. Nie stanowi opinii prawnej, nie zatwierdza implementacji i nie uruchamia produkcyjnego przetwarzania danych małoletnich.

---

## 1. Decyzja kontrolna

Dla baseline V3 utrzymuje się właścicielską politykę:

- minimalny wiek samodzielnego konta: **16 lat**;
- użytkownicy `<16`: **NOT ALLOWED IN BASELINE**;
- brak wdrożonego i autoryzowanego flow zgody rodzica/opiekuna;
- użytkownicy `16–17`: dopuszczalni wyłącznie z dodatkowymi safeguards privacy-by-default;
- marketingowe profilowanie i behavioral targeting małoletnich: **NOT AUTHORIZED**;
- pełna DPIA dla V3: **REQUIRED BEFORE PRODUCTION**.

Próg `16+` jest polityką projektową Gracz.pl i nie jest twierdzeniem, że 16 lat stanowi uniwersalny ustawowy minimalny wiek korzystania z każdej usługi internetowej. Szczegółowe podstawy prawne, prawo umów i model zgód muszą pozostać przedmiotem finalnego review.

---

## 2. Zakres kontroli

PL-C12 obejmuje co najmniej:

1. rejestrację i age assurance;
2. publiczny profil i ranking;
3. prywatne wiadomości i załączniki;
4. publiczny chat i funkcje social;
5. matchmaking i kontakt z nieznajomymi;
6. moderację, zgłoszenia, sankcje i odwołania;
7. security telemetry i anti-abuse;
8. newsletter i marketing;
9. retencję danych związanych z wiekiem;
10. providerów przetwarzających dane użytkowników 16–17;
11. prawa osoby, deletion/restriction i legal hold;
12. backup/restore i anti-resurrection.

---

## 3. Age assurance i minimalizacja

Model V3 powinien stosować najmniej inwazyjny mechanizm wystarczający do egzekwowania baseline `16+`.

Wymagania:

- nie przechowywać pełnej daty urodzenia, jeśli wystarcza flaga/grupa wieku;
- nie żądać domyślnie PESEL, skanu dowodu ani paszportu;
- próg wieku ma zostać sprawdzony przed aktywacją konta;
- brak potwierdzenia wymaganego wieku = brak aktywacji konta;
- mechanizm nie może tworzyć nowej, zbędnej bazy danych identyfikacyjnych;
- każda silniejsza forma age assurance wymaga osobnej oceny proporcjonalności i aktualizacji DPIA.

---

## 4. Użytkownicy 16–17 — privacy by default

Dla grupy 16–17 wymagane są co najmniej:

- ograniczony publiczny profil;
- brak ujawniania dokładnego wieku, daty urodzenia, e-maila, dokładnej lokalizacji i innych danych kontaktowych;
- bardziej restrykcyjne ustawienia prywatności tam, gdzie funkcja tworzy ryzyko ekspozycji;
- łatwe blokowanie innych użytkowników;
- łatwe zgłaszanie nadużyć;
- skuteczna moderacja publicznego chatu i funkcji społecznościowych;
- szczególna kontrola dostępu do prywatnych wiadomości i moderation evidence;
- human review dla poważnych sankcji;
- prosty i zrozumiały język privacy notice i regulaminu;
- brak marketingowego profilowania małoletnich w baseline.

---

## 5. Użytkownicy poniżej 16 lat

Status baseline:

```text
UNDER 16 ACCOUNT = NOT ALLOWED
PARENT / GUARDIAN CONSENT FLOW = NOT IMPLEMENTED
PARENT / GUARDIAN DATA COLLECTION = NOT AUTHORIZED
UNDER 16 PRODUCTION ACCESS = BLOCKED BY SEPARATE GATE
```

Jeżeli projekt kiedykolwiek dopuści `<16`, wymagany jest osobny formalny gate obejmujący co najmniej:

- podstawę prawną i model zgody rodzica/opiekuna, jeśli właściwy;
- proporcjonalną weryfikację zgody/opieki;
- minimalizację danych rodzica/opiekuna;
- zaktualizowane ROPA, privacy notice i regulamin;
- odrębne okresy retencji consent evidence;
- age-appropriate design;
- aktualizację pełnej DPIA;
- testy funkcjonalne i negatywne.

---

## 6. Marketing i newsletter

Dla użytkowników małoletnich:

- newsletter nie może być warunkiem konta ani gry;
- zgoda newsletterowa musi być oddzielna od regulaminu;
- brak zgody = brak marketingowej wysyłki;
- profiling/behavioral targeting `<18` pozostaje `NOT AUTHORIZED` bez osobnego review;
- unsubscribe/withdrawal musi zatrzymywać przyszłe wysyłki;
- restore nie może reaktywować wycofanej zgody.

Otwarte HOLD-y z PL-R06 dotyczące consent proof i suppression record pozostają bez zmian.

---

## 7. Publiczny profil, chat, social i messaging

Kontrola minors wymaga, aby projekt nie traktował samego użycia pseudonimu jako wystarczającego zabezpieczenia.

Wymagane są:

- minimalna widoczność profilu;
- brak publikacji danych kontaktowych;
- możliwość blokowania i raportowania;
- moderacja publicznych treści;
- ograniczenia dostępu do plaintext prywatnych wiadomości;
- brak wtórnego wykorzystania treści małoletnich do marketingu/profilowania;
- case-specific review dla moderation evidence;
- odpowiednie safeguards przy kontakcie z nieznajomymi.

---

## 8. DPIA — warunek blokujący

PL-E11 zakończył screening i jednoznacznie ustalił:

```text
DPIA REQUIRED = YES
FULL DPIA COMPLETED = NO
HIGH-RISK PROCESSING MAY START NOW = NO
```

Małoletni 16–17 są jedną z materialnych przyczyn tej decyzji, razem z prywatną komunikacją, moderacją, security telemetry, łączeniem danych i skalą V3.

W związku z tym PL-C12 nie może otrzymać pełnego `PASS` przed zakończeniem pełnej DPIA i zatwierdzeniem ryzyka rezydualnego dla modelu małoletnich.

---

## 9. Otwarte warunki

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-C12-O01 | wykonać pełną DPIA z deep-dive dla użytkowników 16–17 | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-C12-O02 | zatwierdzić finalny model prawa właściwego / prawa umów dla kont 16–17 | P1 Legal | Privacy/Legal | `OPEN` |
| PL-C12-O03 | zsynchronizować próg wieku i safeguards z finalnym regulaminem i privacy notice | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-C12-O04 | zdefiniować i przetestować minimalny age-assurance / negative registration tests | P1 Privacy/Product | Privacy/Legal + Engineering | `OPEN` |
| PL-C12-O05 | przetestować privacy-by-default dla profilu, rankingu, chat/social i messaging | P1 Privacy/Product | Product + Privacy/Legal | `OPEN` |
| PL-C12-O06 | potwierdzić brak marketingowego profilowania małoletnich w produkcyjnym inventory | P1 Privacy/Marketing | Privacy/Legal | `OPEN` |
| PL-C12-O07 | objąć model małoletnich provider/DPA/transfer review | P1 Privacy/Legal | Privacy/Legal | `OPEN` |

---

## 10. Formalna decyzja PL-C12

```text
PL-C12 = HOLD

BASELINE MINIMUM AGE = 16
UNDER 16 = NOT ALLOWED IN BASELINE
PARENT / GUARDIAN CONSENT FLOW = NOT IMPLEMENTED / NOT AUTHORIZED
16–17 SAFEGUARDS = DEFINED / OPERATIONAL EVIDENCE PENDING
MARKETING PROFILING OF MINORS = NOT AUTHORIZED
FULL DPIA = REQUIRED / NOT COMPLETED
FINAL TERMS + PRIVACY NOTICE ALIGNMENT = OPEN P1
AGE-ASSURANCE TEST EVIDENCE = OPEN P1
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = HOLD
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

`HOLD` nie oznacza odrzucenia modelu `16+`. Oznacza, że projekt posiada sensowny baseline i safeguards, lecz materialne wymagania przedprodukcyjne nie są jeszcze zamknięte.

---

## 11. Granica autoryzacji

Utworzenie PL-C12:

- nie uruchamia rejestracji ani age assurance;
- nie dopuszcza osób `<16`;
- nie tworzy parental consent flow;
- nie zatwierdza marketingu małoletnich;
- nie kończy pełnej DPIA;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.
