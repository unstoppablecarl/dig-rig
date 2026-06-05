<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
</script>
<template>
  <div id="help" :class="{ show: model }" @click="model = false">
    <div class="controls">
      <div style="text-align: right">[Close X]</div>
      <table class="table-controls">
        <tbody>
        <tr>
          <th>Controls</th>
          <td></td>
        </tr>
        <tr>
          <th>Move</th>
          <td>WASD / Arrow keys</td>
        </tr>
        <tr>
          <th>Jump</th>
          <td>WASD / Arrow keys / Space</td>
        </tr>
        <tr>
          <th>Fire mode destroy</th>
          <td>Left Mouse</td>
        </tr>
        <tr>
          <th>Fire mode create</th>
          <td>Right Mouse</td>
        </tr>
        <tr>
          <th>Change weapon</th>
          <td>Numbers 1, 2, 3...</td>
        </tr>
        <tr>
          <th>Zoom</th>
          <td>Shift + mouse wheel</td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
<style lang="scss">
#help {
  display: none;
  position: absolute;
  background: rgba(0, 0, 0, .5);
  width: 100%;
  height: 100%;
  cursor: pointer;

  &.show {
    display: block;
  }

  .controls {
    margin: 20vh 20vh;
    padding: 20px;
    background: #000;
    display: inline-block;
  }

  .table-controls {
    th {
      text-align: right;
      padding: 4px 10px;
    }

    td {
      text-align: left;
      padding: 4px 10px;
    }
  }
}
</style>