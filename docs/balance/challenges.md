# Challenges, measured (generated)

`npx vite-node scripts/challenges.ts --seeds 40 --from 1`: seeds 1–40, Normal. Each cell is
wins out of 40, then the mean survivors at the end, the mean deaths in each age's catastrophe and the mean cells it
reached. Bots, not people: the route policies were tuned on the standard valley and do not adapt to a challenge, so
these numbers measure what a challenge does to a fixed plan, not how hard it is for a player who reads it.

## Greenvale

| Challenge | Policy | Wins | Survivors | Deaths I · II · III | Cells reached I · II · III |
| --- | --- | --- | --- | --- | --- |
| standard | engineers | 39/40 | 10.9 | 0.0 · 0.1 · 0.7 | 249 · 484 · 527 |
| standard | archivists | 40/40 | 13.8 | 1.0 · 1.1 · 0.0 | 395 · 497 · 527 |
| standard | steward | 4/40 | 12.1 | 1.1 · 0.0 · 0.0 | 402 · 496 · 527 |
| Fertile Floodplain | engineers | 40/40 | 11.2 | 0.0 · 0.3 · 0.8 | 249 · 560 · 527 |
| Fertile Floodplain | archivists | 40/40 | 13.8 | 1.0 · 1.1 · 0.0 | 395 · 578 · 527 |
| Fertile Floodplain | steward | 4/40 | 11.9 | 1.1 · 0.1 · 0.0 | 402 · 576 · 527 |
| Storm Front | engineers | 39/40 | 11.4 | 0.0 · 0.3 · 0.7 | 249 · 561 · 527 |
| Storm Front | archivists | 40/40 | 13.9 | 1.0 · 1.0 · 0.0 | 395 · 577 · 527 |
| Storm Front | steward | 5/40 | 11.9 | 1.1 · 0.0 · 0.0 | 402 · 577 · 527 |
| Dry Summers | engineers | 36/40 | 10.2 | 0.2 · 0.0 · 0.6 | 310 · 429 · 527 |
| Dry Summers | archivists | 40/40 | 13.1 | 1.0 · 1.6 · 0.0 | 483 · 446 · 527 |
| Dry Summers | steward | 1/40 | 10.3 | 1.1 · 0.0 · 0.0 | 485 · 444 · 527 |
| Thin Woods | engineers | 40/40 | 11.2 | 0.4 · 0.1 · 0.4 | 171 · 545 · 527 |
| Thin Woods | archivists | 39/40 | 13.5 | 1.0 · 1.6 · 0.0 | 212 · 542 · 527 |
| Thin Woods | steward | 0/40 | 11.6 | 0.6 · 0.0 · 0.0 | 232 · 541 · 527 |
| Overgrown | engineers | 39/40 | 10.7 | 0.0 · 0.1 · 0.9 | 309 · 474 · 527 |
| Overgrown | archivists | 40/40 | 13.5 | 1.0 · 1.4 · 0.0 | 464 · 493 · 527 |
| Overgrown | steward | 0/40 | 11.7 | 1.1 · 0.1 · 0.0 | 467 · 491 · 527 |
| Blight | engineers | 34/40 | 9.9 | 0.0 · 0.1 · 0.5 | 249 · 484 · 527 |
| Blight | archivists | 40/40 | 12.7 | 1.0 · 1.1 · 0.0 | 395 · 497 · 527 |
| Blight | steward | 3/40 | 8.6 | 1.1 · 0.0 · 0.0 | 402 · 496 · 527 |
| Soft Rock | engineers | 39/40 | 11.0 | 0.0 · 0.1 · 0.6 | 249 · 484 · 595 |
| Soft Rock | archivists | 40/40 | 13.8 | 1.0 · 1.1 · 0.0 | 395 · 497 · 595 |
| Soft Rock | steward | 4/40 | 10.6 | 1.1 · 0.0 · 0.0 | 402 · 496 · 595 |
| Rich Vein | engineers | 40/40 | 10.4 | 0.0 · 0.1 · 0.7 | 303 · 487 · 539 |
| Rich Vein | archivists | 40/40 | 13.8 | 1.0 · 1.2 · 0.0 | 428 · 495 · 539 |
| Rich Vein | steward | 4/40 | 12.0 | 1.0 · 0.0 · 0.0 | 439 · 495 · 539 |
| Fractured Fault | engineers | 38/40 | 11.2 | 0.0 · 0.1 · 0.7 | 249 · 484 · 747 |
| Fractured Fault | archivists | 40/40 | 13.3 | 1.0 · 1.6 · 0.0 | 392 · 496 · 747 |
| Fractured Fault | steward | 4/40 | 9.8 | 1.1 · 0.0 · 0.0 | 402 · 496 · 747 |
| Overcrowded Refuge | engineers | 38/40 | 12.6 | 0.0 · 0.3 · 0.9 | 249 · 485 · 527 |
| Overcrowded Refuge | archivists | 40/40 | 15.4 | 1.0 · 1.3 · 0.0 | 395 · 497 · 527 |
| Overcrowded Refuge | steward | 4/40 | 9.1 | 1.0 · 0.0 · 0.0 | 402 · 496 · 527 |
| Elders’ Lore | engineers | 39/40 | 11.0 | 0.0 · 0.1 · 0.8 | 249 · 484 · 527 |
| Elders’ Lore | archivists | 40/40 | 13.8 | 1.0 · 1.1 · 0.0 | 395 · 497 · 527 |
| Elders’ Lore | steward | 4/40 | 12.1 | 1.1 · 0.0 · 0.0 | 402 · 496 · 527 |
| Buried Library | engineers | 39/40 (dug 29) | 10.8 | 0.0 · 0.8 · 1.0 | 249 · 485 · 527 |
| Buried Library | archivists | 40/40 (dug 22) | 13.8 | 1.1 · 0.7 · 0.0 | 394 · 497 · 527 |
| Buried Library | steward | 20/40 (dug 17) | 12.1 | 1.4 · 0.3 · 0.0 | 401 · 496 · 527 |

## The Ashen Winter

| Challenge | Policy | Wins | Survivors | Deaths I · II · III | Cells reached I · II · III |
| --- | --- | --- | --- | --- | --- |
| standard | engineers | 40/40 | 13.5 | 0.0 · 0.1 · 0.6 | 249 · 484 · 872 |
| standard | archivists | 40/40 | 11.3 | 1.0 · 2.7 · 0.9 | 400 · 500 · 872 |
| standard | steward | 0/40 | 0.0 | 1.1 · 0.0 · 12.4 | 402 · 497 · 872 |
| Fertile Floodplain | engineers | 40/40 | 13.5 | 0.0 · 0.3 · 0.7 | 249 · 560 · 872 |
| Fertile Floodplain | archivists | 40/40 | 11.3 | 1.0 · 2.7 · 1.0 | 400 · 582 · 872 |
| Fertile Floodplain | steward | 0/40 | 0.0 | 1.1 · 0.1 · 11.3 | 401 · 578 · 872 |
| Storm Front | engineers | 40/40 | 13.7 | 0.0 · 0.3 · 0.6 | 249 · 561 · 872 |
| Storm Front | archivists | 40/40 | 12.1 | 1.0 · 1.8 · 1.1 | 399 · 582 · 872 |
| Storm Front | steward | 0/40 | 0.0 | 1.1 · 0.0 · 11.2 | 400 · 578 · 872 |
| Dry Summers | engineers | 39/40 | 12.4 | 0.2 · 0.0 · 0.5 | 310 · 429 · 872 |
| Dry Summers | archivists | 40/40 | 11.3 | 1.0 · 2.8 · 0.9 | 484 · 448 · 872 |
| Dry Summers | steward | 0/40 | 0.0 | 1.1 · 0.0 · 10.7 | 485 · 445 · 872 |
| Thin Woods | engineers | 40/40 | 13.4 | 0.4 · 0.1 · 0.8 | 171 · 545 · 872 |
| Thin Woods | archivists | 40/40 | 11.8 | 0.7 · 2.5 · 1.0 | 233 · 545 · 872 |
| Thin Woods | steward | 0/40 | 0.0 | 0.6 · 0.0 · 11.6 | 232 · 542 · 872 |
| Overgrown | engineers | 40/40 | 13.1 | 0.0 · 0.1 · 0.7 | 309 · 474 · 872 |
| Overgrown | archivists | 40/40 | 11.2 | 1.0 · 2.9 · 0.9 | 466 · 495 · 872 |
| Overgrown | steward | 0/40 | 0.0 | 1.1 · 0.1 · 12.1 | 467 · 491 · 872 |
| Blight | engineers | 39/40 | 12.3 | 0.0 · 0.1 · 0.4 | 249 · 484 · 872 |
| Blight | archivists | 40/40 | 11.3 | 1.0 · 2.6 · 0.9 | 400 · 500 · 872 |
| Blight | steward | 0/40 | 0.0 | 1.1 · 0.0 · 8.7 | 402 · 497 · 872 |
| Rich Vein | engineers | 39/40 | 12.6 | 0.0 · 0.1 · 0.8 | 303 · 487 · 872 |
| Rich Vein | archivists | 40/40 | 11.3 | 1.0 · 2.6 · 1.0 | 432 · 499 · 872 |
| Rich Vein | steward | 0/40 | 0.0 | 1.0 · 0.0 · 12.3 | 439 · 496 · 872 |
| Overcrowded Refuge | engineers | 40/40 | 13.5 | 0.0 · 0.3 · 0.5 | 249 · 485 · 872 |
| Overcrowded Refuge | archivists | 40/40 | 14.7 | 1.0 · 3.5 · 1.0 | 400 · 500 · 872 |
| Overcrowded Refuge | steward | 0/40 | 0.0 | 1.0 · 0.0 · 9.3 | 402 · 497 · 872 |
| Elders’ Lore | engineers | 40/40 | 13.6 | 0.0 · 0.1 · 0.6 | 249 · 484 · 872 |
| Elders’ Lore | archivists | 40/40 | 11.3 | 1.0 · 2.7 · 0.9 | 400 · 500 · 872 |
| Elders’ Lore | steward | 0/40 | 0.1 | 1.1 · 0.0 · 12.3 | 402 · 497 · 872 |
| Buried Library | engineers | 40/40 (dug 28) | 12.3 | 0.0 · 0.8 · 1.4 | 249 · 485 · 872 |
| Buried Library | archivists | 40/40 (dug 20) | 11.5 | 1.1 · 2.6 · 0.8 | 399 · 500 · 872 |
| Buried Library | steward | 0/40 (dug 17) | 0.8 | 1.4 · 0.3 · 11.7 | 401 · 497 · 872 |

