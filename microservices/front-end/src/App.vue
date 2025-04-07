<template>
  <div id="app" class="w-50 p-3">
    <div class="d-flex align-items-stretch gap-2">
      <b-form-input 
        v-model="text" 
        placeholder="Enter your name" 
        class="w-100"
      ></b-form-input>
      <button @click="handleClick" class="btn btn-primary w-50 ml-3">
        Click Me
      </button>
    </div>
  </div>
</template>


<script>
import { makeAPICall } from './utils/api';

export default {
  name: "App",
  components: {
  },
  data() {
    return {
      text: ''
    }
  },
  methods: {
    async handleClick() {
      await makeAPICall({
        verb: 'POST',
        route: '/api/msg',
        data:{
          msg: this.text
        }
      });
    }
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
