<template>
  <h2>Home Energy Monitoing</h2>
  <hr />
  <h3>Submit Usage</h3>
  <CreateItem class="form-section" />
  <hr />
  <h3>Get Usage By User ID</h3>
  <GetItemById class="form-section" />
  <hr />
  <h3>Get All Usage</h3>
  <GetItems class="form-section" />
</template>

<script>
import CreateItem from './components/CreateItem'
import GetItems from './components/GetItems'
import GetItemById from './components/GetItemById'
export default {
  name: 'App',
  components: {
    GetItems,
    CreateItem,
    GetItemById,
  },
}
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

#logo {
  display: flex;
  width: 15%;
  flex-direction: column;
  justify-content: center;
  margin: auto;
}

.form-section {
  display: block;
  margin: 2%;
  justify-content: left;
}

.error {
  color: red;
}

div {
  margin: 1%;
}
input {
  margin: 1%;
}
label {
  margin: 1%;
}
</style>
