# ETAP 3 — DML remediation rollback procedure

Data: 28.08.2026  
Status: **ARTEFAKT PLANISTYCZNY — PRODUKCJA NO-GO**

## Zasada

Aktualne artefakty `09a`–`09d` są READ ONLY / NO-OP i kończą się `ROLLBACK`, więc ich wykonanie nie wymaga rollback danych.

Przyszłe mutujące DML może zostać dopuszczone dopiero po: pełnym backupie, udokumentowanym restore teście, świeżym prechecku, writer control, zatwierdzeniu dokładnego zakresu rekordów i maintenance/cutover decision.

## STOP/ROLLBACK

Natychmiast przerwać, jeżeli: zmieni się snapshot targetów; liczba rekordów nie odpowiada precheckowi; pojawi się nowa zależność; aktywna sesja/stan przeczy planowi; DML dotknie więcej rekordów niż zatwierdzono; audit/provenance lub postcheck nie przejdzie.

## Przyszły mutujący przebieg

1. BEGIN.
2. Lock/guard target writerów zgodnie z runbookiem.
3. Powtórz assertions.
4. Wykonaj wyłącznie zatwierdzone DML.
5. Uruchom postcheck w tej samej kontrolowanej procedurze.
6. Przy jakiejkolwiek rozbieżności: ROLLBACK.
7. COMMIT tylko przy pełnym PASS.
8. Po COMMIT rerun data-quality i reconciliation.

Nie używać fizycznego DELETE dla DQ-001/DQ-002 bez osobnej, jawnej decyzji i zachowania provenance.