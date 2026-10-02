import type { ThemeDef } from '../../engine/plugin'
import { SPRITES } from './sprites'

export const classicTheme: ThemeDef = {
  id: 'classic',
  rooms: [
    'Library',
    'Kitchen',
    'Cellar',
    'Attic',
    'Garden',
    'Study',
    'Gallery',
    'Conservatory',
    'Parlor',
    'Workshop',
    'Pantry',
    'Balcony',
    'Laundry',
    'Cloakroom',
    'Observatory',
    'Chapel',
  ],
  suspects: [
    {
      name: 'Ada',
      pronoun: 'she',
      look: { hairStyle: 'longStraight', hairColor: '#e0c068', skin: '#fbdcc4', shirt: '#8a8fa8', glasses: true },
    },
    {
      name: 'Bram',
      pronoun: 'he',
      look: { hairStyle: 'sidePart', hairColor: '#2b1d16', skin: '#8f5a3a', shirt: '#2f6f6f', facialHair: 'fullBeard' },
    },
    {
      name: 'Cora',
      pronoun: 'she',
      look: { hairStyle: 'longWavy', hairColor: '#6b4423', skin: '#e5b48a', shirt: '#3f7fbf' },
    },
    {
      name: 'Dev',
      pronoun: 'he',
      look: { hairStyle: 'quiff', hairColor: '#1c1c24', skin: '#b57a4e', shirt: '#d95f7a' },
    },
    {
      name: 'Elsa',
      pronoun: 'she',
      look: { hairStyle: 'bun', hairColor: '#2b1d16', skin: '#f2c6a0', shirt: '#9b6bc9' },
    },
    {
      name: 'Finn',
      pronoun: 'he',
      look: { hairStyle: 'short', hairColor: '#c1442e', skin: '#fbdcc4', shirt: '#3f7fbf', facialHair: 'stubble' },
    },
    {
      name: 'Gus',
      pronoun: 'he',
      look: { hairStyle: 'buzz', hairColor: '#1c1c24', skin: '#6e4129', shirt: '#e0872e', glasses: true },
    },
    {
      name: 'Hana',
      pronoun: 'she',
      look: { hairStyle: 'bob', hairColor: '#d9742a', skin: '#e5b48a', shirt: '#8a8fa8' },
    },
    {
      name: 'Ivo',
      pronoun: 'he',
      look: { hairStyle: 'curlyTop', hairColor: '#2b1d16', skin: '#4f2e1e', shirt: '#8a8fa8', facialHair: 'moustache' },
    },
    {
      name: 'June',
      pronoun: 'she',
      look: { hairStyle: 'ponytail', hairColor: '#8a5a2b', skin: '#d09a6c', shirt: '#9b6bc9' },
    },
    {
      name: 'Kai',
      pronoun: 'they',
      look: { hairStyle: 'pixie', hairColor: '#b8b8c0', skin: '#fbdcc4', shirt: '#8a8fa8' },
    },
    {
      name: 'Lena',
      pronoun: 'she',
      look: { hairStyle: 'curls', hairColor: '#b8b8c0', skin: '#8f5a3a', shirt: '#c9b04a', glasses: true },
    },
    {
      name: 'Milo',
      pronoun: 'he',
      look: { hairStyle: 'slick', hairColor: '#c68a3a', skin: '#e5b48a', shirt: '#4fa68a', facialHair: 'goatee' },
    },
    {
      name: 'Nora',
      pronoun: 'she',
      look: { hairStyle: 'puff', hairColor: '#1c1c24', skin: '#6e4129', shirt: '#d95f7a' },
    },
    {
      name: 'Otto',
      pronoun: 'he',
      look: { hairStyle: 'receding', hairColor: '#e8e8ee', skin: '#f2c6a0', shirt: '#e0872e', facialHair: 'fullBeard', glasses: true },
    },
    {
      name: 'Pia',
      pronoun: 'she',
      look: { hairStyle: 'longStraight', hairColor: '#1c1c24', skin: '#f2c6a0', shirt: '#4fa68a' },
    },
  ],
  objects: {
    chair: { label: 'Chair', noun: 'a chair', standingOn: 'sitting on a chair', sprite: SPRITES.chair, weight: 0.1 },
    rug: { label: 'Rug', noun: 'a rug', standingOn: 'on a rug', sprite: SPRITES.rug, weight: 0.06 },
    water: { label: 'Water', noun: 'the water', standingOn: 'in the water', sprite: SPRITES.water, weight: 0.04 },
    table: { label: 'Table', noun: 'a table', standingOn: 'on a table', sprite: SPRITES.table, weight: 0.05 },
    shelf: { label: 'Shelf', noun: 'a shelf', standingOn: 'on a shelf', sprite: SPRITES.shelf, weight: 0.03 },
    plant: { label: 'Plant', noun: 'a plant', standingOn: 'on a plant', sprite: SPRITES.plant, weight: 0.03 },
    rock: { label: 'Rock', noun: 'a rock', standingOn: 'on a rock', sprite: SPRITES.rock, weight: 0.02 },
    tree: { label: 'Tree', noun: 'a tree', standingOn: 'on a tree', sprite: SPRITES.tree, weight: 0.02 },
    tv: { label: 'TV', noun: 'a TV', standingOn: 'on a TV', sprite: SPRITES.tv, weight: 0.01 },
  },
  glossary: {
    not: 'The opposite is true: this is where they were not.',
    beside: 'Directly left, right, above or below something, in the same room. Diagonals do not count.',
    'north of': 'In a row above, counting rows from the top of the board. The number says how many rows apart.',
    'west of': 'In a column to the left. The number says how many columns apart.',
    'same room': 'Both were inside the same room, in different squares.',
    alone: 'Nobody else was in the same room.',
    only: 'Nobody else stood on that kind of object.',
    'exactly one other': 'Exactly two people, counting them, were in the room.',
    victim: 'The person who was murdered. Their clue says who they were with.',
    'alone with the murderer': 'The victim and the murderer were the only two people in the room.',
  },
}
