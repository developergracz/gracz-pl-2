# Gracz.pl V3 — PL-E05 Małoletni / wiek / zgody

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Evidence ID: `PL-E05`  
Status: **PASS WITH CONDITIONS / OWNER POLICY RECORDED / FREEZE-SAFE**  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany ROPA: `ROPA-GRACZ-PL-V3.md`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`

> Dokument zapisuje właścicielską politykę projektu dla użytkowników małoletnich. Nie stanowi porady prawnej i nie autoryzuje implementacji ani deploymentu. Przed produkcyjnym uruchomieniem wymagane są wskazane niżej kontrole, aktualizacja privacy notice/regulaminu oraz potwierdzenie zgodności modelu z właściwymi przepisami.

---

## 1. Decyzja projektowa

Na potrzeby formalnego review ADR-V3-012 przyjmuje się następujący model startowy Gracz.pl V3:

1. **Minimalny wiek samodzielnego utworzenia konta: 16 lat.**
2. **Osoby poniżej 16 lat nie mogą samodzielnie zakładać konta ani wyrażać zgody tam, gdzie podstawą przetwarzania jest zgoda w rozumieniu art. 6 ust. 1 lit. a RODO.**
3. Uruchomienie dostępu dla osób poniżej 16 lat wymaga odrębnego, zatwierdzonego programu: zgoda/akceptacja rodzica lub opiekuna, rozsądna weryfikacja tej zgody, age-assurance adekwatny do ryzyka, zaktualizowany privacy notice, regulamin oraz DPIA screening.
4. Użytkownicy w wieku 16–17 lat mogą być dopuszczeni wyłącznie z dodatkowymi zabezpieczeniami privacy-by-default, po potwierdzeniu zgodności modelu konta i regulaminu z prawem właściwym dla małoletnich.
5. Newsletter i marketing nie mogą być warunkiem korzystania z podstawowych funkcji serwisu. Dla użytkowników małoletnich nie uruchamia się profilowania marketingowego ani targetowania behawioralnego bez odrębnej, formalnej decyzji i podstawy prawnej.
6. Publiczny profil, chat, wiadomości prywatne, matchmaking i funkcje social dla użytkowników 16–17 wymagają ustawień domyślnie minimalizujących ekspozycję oraz jasnych mechanizmów zgłaszania, blokowania i moderacji.
7. Projekt nie zbiera kopii dokumentów tożsamości wyłącznie w celu zwykłego potwierdzenia wieku, chyba że późniejsza ocena ryzyka i wymogi prawne wykażą konieczność oraz proporcjonalność takiego rozwiązania.

---

## 2. Uzasadnienie regulacyjne

RODO art. 8 przewiduje, że jeżeli podstawą jest zgoda i usługa społeczeństwa informacyjnego jest oferowana bezpośrednio dziecku, dziecko może samodzielnie wyrazić zgodę po ukończeniu 16 lat; poniżej tego wieku zgoda musi pochodzić od osoby sprawującej władzę rodzicielską lub opiekę albo zostać przez nią zaaprobowana, a administrator powinien podjąć rozsądne starania w celu weryfikacji tego faktu.

UODO również wskazuje, że w przypadku usług online, w tym portali, aplikacji i gier, dla osoby poniżej 16 roku życia decyzję o zgodzie na przetwarzanie podejmuje rodzic lub opiekun, gdy przetwarzanie opiera się na zgodzie.

Próg 16 lat w tej polityce jest zatem konserwatywnym progiem startowym dla projektu i nie oznacza, że każdy proces dotyczący użytkownika 16–17 automatycznie staje się zgodny z prawem. W szczególności pozostają kwestie prawa umów, przejrzystości, minimalizacji, bezpieczeństwa, projektowania usługi dla dzieci i ewentualnego DPIA.

---

## 3. Model rejestracji i age assurance

### 3.1. Rejestracja standardowa

- użytkownik podaje datę urodzenia albo oświadczenie wieku w minimalnym zakresie potrzebnym do zakwalifikowania do grupy wiekowej;
- system nie powinien przechowywać pełnej daty urodzenia, jeżeli do celu wystarcza flaga/grupa wiekowa typu `16+` / `UNDER_16_BLOCKED`;
- próg wieku jest sprawdzany przed utworzeniem aktywnego konta;
- brak potwierdzenia wymaganego wieku powoduje brak aktywacji konta;
- komunikat dla użytkownika ma być jasny i napisany prostym językiem.

### 3.2. Osoby poniżej 16 lat

Status startowy: **NOT ALLOWED IN V3 BASELINE**.

Dopuszczenie tej grupy wymaga osobnego gate i co najmniej:

- modelu zgody rodzica/opiekuna,
- rozsądnej weryfikacji, że zgody udziela osoba uprawniona,
- minimalizacji danych rodzica/opiekuna,
- retencji dowodu zgody,
- możliwości wycofania zgody,
- mechanizmu przejścia po osiągnięciu właściwego wieku,
- osobnego privacy notice lub warstwy informacji zrozumiałej dla dziecka,
- DPIA screening i ewentualnej DPIA.

---

## 4. Użytkownicy 16–17 lat — dodatkowe zabezpieczenia

Dla tej grupy przyjmuje się projektowo:

- profil publiczny ograniczony do minimum;
- brak ujawniania dokładnego wieku, daty urodzenia, lokalizacji, e-maila lub innych danych kontaktowych;
- domyślne ustawienia prywatności bardziej restrykcyjne niż dla dorosłych, jeśli funkcja tego wymaga;
- łatwe blokowanie innych użytkowników;
- łatwe zgłaszanie nadużyć;
- moderacja chatu i treści społecznościowych;
- ograniczenie ryzykownego kontaktu z nieznajomymi w zakresie wymagającym oceny produktowej i bezpieczeństwa;
- brak marketingowego profilowania dzieci jako domyślny baseline;
- komunikaty privacy/regulamin sformułowane jasno i zrozumiale.

---

## 5. Newsletter / marketing

- newsletter nie jest częścią obowiązkową konta;
- zgoda newsletterowa jest odrębna od akceptacji regulaminu;
- wycofanie zgody nie wpływa na możliwość korzystania z podstawowych funkcji Gracz.pl;
- dla użytkowników poniżej 18 lat kampanie marketingowe, profilowanie i personalizacja reklam wymagają odrębnego review przed wdrożeniem;
- brak osobnej zgody oznacza brak wysyłki marketingowej.

---

## 6. Dane i retencja związane z wiekiem

Projekt ma stosować zasadę minimalizacji:

| Dane | Zasada |
|---|---|
| pełna data urodzenia | nie przechowywać, jeśli wystarczy informacja o grupie wiekowej |
| grupa wiekowa / flaga | przechowywać tylko tak długo, jak jest potrzebna do stosowania reguł konta |
| dowód zgody opiekuna | nie dotyczy baseline, ponieważ UNDER-16 jest zablokowane; jeśli model zostanie kiedyś uruchomiony — retencja wymaga osobnej decyzji |
| dokument tożsamości | brak gromadzenia w baseline |
| dane kontaktowe opiekuna | brak gromadzenia w baseline |

---

## 7. Wymagane zmiany dokumentacyjne przed produkcją

Przed `ADR-V3-012 ACCEPTED / FINAL` i przed produkcyjnym uruchomieniem V3 należy:

1. wpisać minimalny wiek i model konta do regulaminu;
2. wpisać model wieku do privacy notice;
3. zaktualizować ROPA oraz PL-E03;
4. wykonać DPIA screening dla funkcji społecznościowych, wiadomości, moderacji i modelu użytkowników 16–17;
5. potwierdzić, czy planowany zakres usługi nie wymaga dodatkowej profesjonalnej opinii prawnej;
6. zdefiniować testy negatywne blokujące rejestrację osoby poniżej przyjętego progu;
7. zapewnić, że implementacja nie zbiera nadmiarowych danych tylko dla sprawdzenia wieku.

---

## 8. Formalny status PL-E05

```text
PL-E05 = PASS WITH CONDITIONS
BASELINE MINIMUM AGE = 16
UNDER 16 = NOT ALLOWED IN BASELINE
PARENT/GUARDIAN CONSENT FLOW = NOT IMPLEMENTED / NOT AUTHORIZED
AGE ASSURANCE = MINIMAL / DESIGN REQUIRED BEFORE IMPLEMENTATION
16–17 PRIVACY SAFEGUARDS = REQUIRED
MINORS DPIA SCREENING = REQUIRED BEFORE FINAL PASS
MARKETING PROFILING OF MINORS = NOT AUTHORIZED
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
FREEZE = ACTIVE
```

### Warunki zamknięcia do pełnego PASS

- privacy notice i regulamin zawierają zatwierdzony próg wieku;
- DPIA screening zakończony;
- model 16–17 potwierdzony pod kątem prawa właściwego i prawa umów;
- age-assurance jest proporcjonalny i przetestowany;
- brak produkcyjnego dopuszczenia `<16` bez osobnego gate;
- dokumentacja ROPA/PL-E03/PL-E04 jest zsynchronizowana z tą decyzją.

---

## 9. Decision Owner

Privacy/Legal Decision Owner: **Czesław Socha**  
Projekt: **Gracz.pl**  
Data decyzji dokumentacyjnej: **01.09.2026**

Dokument jest artefaktem formalnego review ADR-V3-012, lecz nie stanowi samodzielnego `ACCEPTED / FINAL` dla całego ADR.