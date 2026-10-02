# Whodoku: Suspect Identity Spec

Status: approved by the owner, including the "murderer" wording and the classic pronoun list. Date: 2026-10-02. Amends `2026-10-02-ui-redesign-spec.md` (portraits) and
`2026-10-02-clue-hints-spec.md` (clue text). Based on the reference player's cards and clues,
observed in screenshots; no reference assets or text are copied.

## 1. Goal

Make suspects recognisable at a glance. Today a portrait is picked by hashing the name, so nothing
distinguishes a man from a woman, and clues repeat the suspect's name, which the card already
shows. The reference gives each suspect a distinct, clearly gendered face and words the clue as
"She was beside a plant." This spec adds the data and the art to do the same.

## 2. Data

- A suspect is `{ name, pronoun }` where `pronoun` is `'she' | 'he' | 'they'`. It is a property of
  the character, chosen by the theme author, never guessed from the name.
- `ThemeDef.suspects` becomes a list of suspect definitions (name, pronoun, optional `look`). The
  optional `look` lets an author pin any part of a portrait (skin, hair style, hair colour, facial
  hair, clothing, glasses); the generator fills in whatever is not pinned, deterministically from
  the name.
- `Suspect` in the kernel puzzle type gains `pronoun` (default `'they'` for puzzles saved earlier).
- The classic theme assigns pronouns explicitly: she for Ada, Cora, Elsa, Hana, June, Lena, Nora,
  Pia; he for Bram, Dev, Finn, Gus, Ivo, Milo, Otto; they for Kai. One `they` character keeps the
  plural verb form exercised.

## 3. Portraits

- The generator draws from a pool matched to the pronoun, with at least eight hair styles per pool,
  so neighbours on a card grid look different:
  - she: long straight, long wavy, bob, shoulder-length curls, bun, ponytail, pixie, afro puff.
  - he: short, side part, buzz, curly top, receding, with a full beard, goatee, stubble or
    moustache.
  - they: any style from either pool.
- Beyond hair: visible ears, a neck with a collar, a jaw shape (rounder or squarer), shoulder width,
  and clothing that varies (tee, collared shirt, plaid shirt, hoodie, blouse). Earrings are drawn
  for some `she` and `they` portraits, glasses for about one in five of any.
- Style target is the reference's cards: flat colour, a darker right half of the face, a thick dark
  outline, and no facial features. Backgrounds stay muted and distinct across a card grid.
- Skin tones, hair colours (including grey and white) and clothing colours come from larger palettes
  than today's, and the generator avoids giving two suspects of the same puzzle the same
  hair-style-and-colour pair.
- A board token is the same bust without its background, outlined, with the suspect's initial badge
  in its top-left corner (see the notes and placement spec).

## 4. Clue voice

- A clue is about the card it is on, so the subject is a pronoun: "She was beside a plant.",
  "He was in the Library.", "They were with exactly one other person." Other suspects are still
  named ("She was south of Cameron.").
- The pronoun carries the verb ("was" or "were"). The subject piece is plain text: it is not bold
  and it never lights a card.
- The victim's clue is prefixed "The Victim." and the other suspect is "the murderer":
  "The Victim. He was alone with the murderer." The result sentence keeps "killed".
- This replaces the person piece the clue hints spec starts every clue with; every clue type's
  parts change accordingly, and the existing text tests change with them.

## 5. Testing

- Portrait generator: deterministic per name; every pool has at least eight styles; a `she` portrait
  never uses a beard or moustache, a `he` portrait never uses a pool-restricted she style, and
  `they` can use both; pinned `look` fields are honoured; no two suspects of a generated puzzle
  share the same style and colour pair.
- Clue text: every clue type renders with each pronoun, including "were" for `they`, and the
  victim form.
- Visual check: a contact sheet of all sixteen classic suspects, reviewed by the owner before this
  is called done.

## 6. Out of scope

- Letting players choose pronouns or portraits.
- Translating pronouns.
- Hats, hair accessories and other optional props beyond earrings and glasses.

## 7. Assumptions to confirm

- The clue wording "murderer" replaces "killer" in clue text, as in the reference.
- The pronoun assignments for the classic theme in section 2, including one `they`.
