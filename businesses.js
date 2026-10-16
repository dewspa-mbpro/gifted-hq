// The building's directory. Add a business by adding an entry here.
// id: letters/digits only (used in the address bar, e.g. index.html#decree)
// floor: which storey the office sits on (1 is the first floor above the lobby)
// rooms: the rooms on that floor; each room lists notes, and a note can carry a link
window.BUILDING = {
  name: "Gifted HQ",
  address: "Every business under one roof",
  businesses: [
    {
      id: "decree",
      name: "DECREE",
      floor: 2,
      tagline: "Voice agent, built around voxctl",
      color: "#4F5BD5",
      status: "Moving to its own project",
      rooms: [
        {
          name: "Reception",
          kind: "about",
          notes: [
            { text: "voxctl is the core voice agent." },
            { text: "The Mac mini is the development machine." },
            { text: "The MacBook runs the installed product." }
          ]
        },
        {
          name: "Engineering",
          kind: "work",
          notes: [
            { text: "voxctl" },
            { text: "handsfree" },
            { text: "Decree" },
            { text: "music-reorg" },
            { text: "None of these repos are connected on GitHub yet.", muted: true }
          ]
        },
        {
          name: "Records",
          kind: "files",
          notes: [
            { text: "Decree status picture", href: "https://claude.ai/code/artifact/fb6f4655-d45e-46d1-aacd-ae8ce37afa01" },
            { text: "DECREE-HANDOFF.md was overwritten on 8 Sep. Restore the 3,034-line master from Time Machine as DECREE-HANDOFF-master.md." }
          ]
        },
        {
          name: "Next up",
          kind: "todo",
          notes: [
            { text: "Move Decree into its own project." },
            { text: "Restore the master handoff file." }
          ]
        }
      ]
    },
    {
      id: "pour",
      name: "P.O.U.R.",
      floor: 3,
      tagline: "Clothing brand",
      color: "#0E8C7F",
      status: "Selling on Etsy",
      rooms: [
        {
          name: "Reception",
          kind: "about",
          notes: [
            { text: "Original clothing designs." },
            { text: "Sold on Etsy, printed and shipped by Printful." }
          ]
        },
        {
          name: "Design studio",
          kind: "work",
          notes: [
            { text: "New design" },
            { text: "Print-ready file" },
            { text: "Etsy and Printful listing" }
          ]
        },
        {
          name: "Storefront",
          kind: "files",
          notes: [
            { text: "Etsy", href: "https://www.etsy.com/" },
            { text: "Printful", href: "https://www.printful.com/" }
          ]
        },
        {
          name: "Next up",
          kind: "todo",
          notes: [
            { text: "Add the shop link and current listings here." }
          ]
        }
      ]
    }
  ]
};
