# Gifted HQ: the office building

A 3D office building that holds every business, and your person walks through it. You start in the lobby (reception desk, directory board, elevator). Walk to the elevator, pick a floor, and you arrive in that business's office: a corridor with rooms on both sides, each with a door sign, a desk and a board of notes you can read.

## Run it

No install or build step. Either open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Jump straight to an office with its id in the address: `http://localhost:8000/#decree`.

Controls: W A S D or the arrow keys to walk and turn, Shift to hurry, drag to look around, E (or tap the prompt) to use the elevator or read a board, Esc to close a panel. Phones and tablets get an on-screen walk pad. "Your look" changes your person's shirt and skin colour, remembered in that browser.

The 3D engine is three.js 0.159.0, loaded from jsDelivr, so the page needs an internet connection.

## Add or change a business

Everything lives in `businesses.js`. Each business has:

| Field | What it does |
|---|---|
| `id` | Letters and digits only; used in the address (`#pour`) |
| `name` | Shown on the directory board and the office door |
| `floor` | Which storey the office is on (1 = first floor above the lobby) |
| `tagline`, `status` | Short lines under the office name |
| `color` | The business's colour for its windows and rooms |
| `rooms` | Rooms on the floor, laid out in pairs down the corridor; each has `name`, `kind` and a list of `notes` (`text`, optional `href`, optional `muted`) |

The lobby directory always lists one empty floor above the highest tenant, ready for the next business.

## Files

- `index.html`: the page shell
- `styles.css`: the on-screen panels (floor indicator, elevator buttons, boards, walk pad)
- `app.js`: builds each storey in 3D, your person and how they walk, the elevator ride
- `businesses.js`: the building directory (seeded with DECREE and P.O.U.R.)
