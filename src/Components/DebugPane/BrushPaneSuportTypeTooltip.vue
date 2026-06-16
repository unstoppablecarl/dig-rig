<template>
  <div class="support-type-tooltip">
    <div>
      <strong>None:</strong> normal physics; falls, flows, or is empty
    </div>
    <div>
      <strong>Affixed:</strong> stays in place but plays no structural role
    </div>
    <div>
      <strong>Structural:</strong> held up by island connectivity to anchored; collapses to powder if disconnected
    </div>
    <div>
      <strong>Anchored:</strong> immovable root; never collapses
    </div>
  </div>
</template>
<style lang="scss">
.support-type-tooltip div {
  margin-bottom: 0.5rem;

  strong {
    color: #fff;
  }
}
</style>