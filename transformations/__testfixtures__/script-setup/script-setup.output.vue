<template>
  <p>{{ msg }}</p>
  <HelloWorld />
  <AsyncExample />
</template>

<script lang="ts" setup>
import { defineAsyncComponent, PropType } from "vue";
import HelloWorld from './components/HelloWorld.vue';

const AsyncExample = defineAsyncComponent(() => import('./async-example.vue'))

type DefaultObject = {
  greeting: string;
};

class Book {
  constructor(public title: string, public author: string) {
    this.title = title
    this.author = author
  }
}

type Props = {
  propNativeConstrutor1?: string,
  propNativeConstrutor2?: Date,
  propNativeConstrutor3?: Book,
  propNativeConstrutor4?: string | number,
  propObjectDefault1: number,
  propObjectDefault2: string | number,
  propObjectDefault3: DefaultObject,
  propObjectRequired1: boolean,
  propObjectRequired2: DefaultObject,
  propObjectRequired3: () => number
}

const props = defineProps(
  {
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
  }
);

const emit = defineEmits(['event', 'update'])

const a = 1;

const data = {
    msg: 'Hello',
};

console.log(props.propObjectRequired1);

emit('event', 'Hello');
</script>

