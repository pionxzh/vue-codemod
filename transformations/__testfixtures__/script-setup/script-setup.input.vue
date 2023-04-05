<template>
  <p>{{ msg }}</p>
  <HelloWorld />
  <AsyncExample />
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, PropType } from "vue";
import HelloWorld from './components/HelloWorld.vue';

type DefaultObject = {
  greeting: string;
};

class Book {
  constructor(public title: string, public author: string) {
    this.title = title
    this.author = author
  }
}

export default defineComponent({
  name: 'Example',
  components: {
    HelloWorld,
    AsyncExample: defineAsyncComponent(() => import('./async-example.vue')),
  },
  props: {
    propNativeConstrutor1: String,
    propNativeConstrutor2: Date,
    propNativeConstrutor3: Book,
    propNativeConstrutor4: [String, Number],
    propObjectDefault1: {
        type: Number,
        default: 0,
    },
    propObjectDefault2: {
        type: [Number, String],
        default: () => 0,
    },
    propObjectDefault3: {
        type: Object as PropType<DefaultObject>,
        default: () => ({ greeting: 'Hello' }),
    },
    propObjectRequired1: {
        type: Boolean,
        required: true,
    },
    propObjectRequired2: {
        type: Object as DefaultObject,
        required: true,
    },
    propObjectRequired3: {
        type: Object as PropType<DefaultObject>,
        required: true,
    },
    propObjectRequired4: {
        type: Object as PropType<() => number>,
        required: true,
    },
  },
  emits: ['event', 'update'],
  setup(props, context) {
    const a = 1;

    const data = {
      msg: 'Hello',
    };

    console.log(props.propObjectRequired1);

    context.emit('event', 'Hello');

    return {
      a,
      data,
    };
  }
});
</script>

