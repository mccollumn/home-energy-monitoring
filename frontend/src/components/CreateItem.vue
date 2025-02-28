<template>
  <div>
    <form @submit.prevent="createItem">
      <div>
        <label for="userId">Date </label>
        <input type="text" id="userId" v-model="formData.date" />
      </div>
      <div>
        <label for="userName">Usage (kWh)</label>
        <input type="text" id="userName" v-model="formData.usage" />
      </div>
      <div>
        <button>Submit Usage</button>
      </div>
    </form>
    <h3 v-if="response">Submitted</h3>
    <h3 class="error" v-if="errorMsg">{{ errorMsg }}</h3>
  </div>
</template>

<script>
import axios from 'axios'
export default {
  name: 'CreateItem',
  data() {
    return {
      formData: {
        date: '',
        usage: '',
      },
      errorMsg: '',
      response: '',
    }
  },
  methods: {
    createItem() {
      axios
        .post(process.env.VUE_APP_API_ENDPOINT, this.formData)
        .then((response) => {
          console.log(response)
          this.response = response
        })
        .catch((error) => {
          console.log(error)
          this.errorMsg = 'Error posting data'
        })
    },
  },
}
</script>

<style scoped></style>
