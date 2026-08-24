# Matter & Matter Tanks

## Matter

Matter is the substance of the world — terrain, sand, liquid, lava, acid, everything that isn't empty space. The total amount of matter in the world is fixed. It moves between terrain and matter tanks, and changes form, but it never appears or disappears on its own.

The one exception is the brush — a level-editing tool that sits outside the game's economy entirely.

### Fill: sub-tile matter

A solid tile (rock, sand, terrain) is always either present or gone — one whole unit of matter. A liquid tile (water, acid, lava, oil...) instead holds a **fill** amount from 1 up to a max (`FILL_MAX`), so a liquid pool can drain, split, and re-settle at less than a full tile per cell instead of jumping between all-or-nothing states. A full liquid tile (`fill == FILL_MAX`) is worth exactly the same one unit of matter as a solid tile; a half-full one is worth half.

This matters for anything priced per-tile against lava or acid (see Reserved Capacity below): liquid flow can fragment a single placed tile's mass across several physical cells over time. Anywhere the economy needs to stay exact, it prices by fill, not by how many cells the liquid happens to occupy at the moment — a pool that splits into five thin puddles still totals the same matter, and still owes back the same amount, as the one full tile it came from.

## Matter Tanks

Every actor that can dig or build owns a matter tank: a quantity of matter, up to a max capacity.

- **Destroy** (dig) turns terrain into empty space and pays the matter into the actor's tank.
- **Create** (build) spends matter from the tank to fill empty space.

Digging is how you earn matter. Building is how you spend it. A full tank can't dig until it spends some; an empty tank can't build until it digs some. Matter is a resource you pull out of the world and put back into it — never generated from nothing.

## Reserved Capacity

A beam doesn't resolve instantly — it eats through tiles over several frames. The moment it fires, it reserves what it will need to finish:

- A **create** beam reserves the matter it's about to spend.
- A **destroy** beam reserves the space it's about to fill.

This stops two actions from promising the same matter, or the same space, twice. The reservation is paid down tile by tile as the beam resolves, and dropped entirely if the beam leaves the world before finishing.

## Lava and Acid: Matter on Credit

Lava and acid are unstable. Once placed, they keep eating the world — lava melts ground and sets things alight, acid dissolves whatever it touches. The matter freed by that consumption always pays back to whoever owns the lava or acid doing the consuming — never the matter being consumed, even when the thing consumed has an owner of its own (someone else's lava pool, say). This is exactly why lava and acid require an owner: there's always exactly one place a destruction's payout can go, and it's never optional.

That payout is a promise made the instant the tile is created, so the system reserves for it immediately:

- **Lava** reserves 1 unit of destroy-capacity per full tile — it eventually consumes itself and pays that back.
- **Acid** reserves 2 per full tile — it consumes itself *and* whatever it dissolves, and pays back both.

"Per full tile" means per unit of fill, not per grid cell: the reservation is made and released in proportion to fill, so it stays correct no matter how a pool of lava or acid fragments across cells while flowing (see Fill: sub-tile matter above). A tile that's only half full holds half the reservation; two half-full fragments split from one original tile still add up to exactly the one reservation that was made when it was placed.

The reservation lasts as long as the tile is lava or acid, and is dropped the moment that stops being true — whether the promise is kept (it dissolves and the matter lands in the tank) or not (something else destroys it first, or it cools to rock). Either way, the books close.

This is why placing lava or acid quietly eats into your destroy capacity before anything has actually happened: the system is holding room for what it already knows is coming.

## Fire: The One Unaccountable Thing

Fire isn't matter. It has no weight and nothing to give back — when it burns out, it just ends. What it ignites *is* matter, and that payout happens the moment it catches, not when the fire dies — catching fire is the destruction event.

There's no way to know in advance how much a fire will eventually consume before it burns out, so it's the one thing in this economy that can't be reserved for. It's the deliberate wild card: owner-attributed and consequential, but unbounded.

This is what overflow tanks are for. A tank can chain to an overflow tank, so that matter a tank can't hold spills somewhere else instead of being lost. It exists because fire can hand you a bill you never got to reserve for.

## Ignition and Air

Fire only ignites adjacent fuel if that fuel has at least one empty tile next to it. Buried or fully enclosed matter doesn't catch — combustion requires exposure to air. This applies to all ignition paths: fire spreading to plant, oil spreading its burn to a neighboring oil tile, and so on. A tile with no empty neighbor is shielded from ignition regardless of how much fire surrounds it.

## Ownership

Plain terrain belongs to no one — it's just there, inert. Matter that *destroys other matter as part of what it does* is different: lava, acid, and fire today, and — as the design grows — anything explosive or corrosive. Every type in that category requires an owner. There's no such thing as ownerless lava; if it can consume other matter and pay it out, something has to be able to receive the payout.

Ownership decides who gets credited, and it always tracks the destroyer, never the destroyed. Destroy someone else's lava pool with your own digging beam and two separate things happen: you're credited for the matter (you did the destroying), while the lava's original creator just has their reservation closed (their tile is gone, so that promise can never be paid). Two different tanks, two different reasons — nothing transfers between them.

Ownership also carries forward through conversion, not just creation. When lava ignites a neighboring tile into fire, that fire inherits the lava's owner; if it spreads further, each new fire tile inherits it again. A creator can keep getting paid many steps removed from the tile they actually placed.
