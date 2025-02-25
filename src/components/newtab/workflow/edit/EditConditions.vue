<template>
  <div>
    <ui-button
      :disabled="conditions.length >= 10"
      variant="accent"
      class="mb-4"
      @click="addCondition"
    >
      {{ t('workflow.blocks.conditions.add') }}
    </ui-button>
    <ui-list class="space-y-1">
      <ui-list-item
        v-for="(item, index) in conditions"
        :key="item.id"
        class="group"
      >
        <v-remixicon name="riGuideLine" size="20" class="mr-2 -ml-1" />
        <p class="flex-1 text-overflow" :title="item.name">
          {{ item.name }}
        </p>
        <v-remixicon
          class="cursor-pointer group-hover:visible invisible"
          name="riPencilLine"
          size="20"
          @click="editCondition(index)"
        />
        <v-remixicon
          name="riDeleteBin7Line"
          size="20"
          class="ml-2 -mr-1 cursor-pointer"
          @click="deleteCondition(index)"
        />
      </ui-list-item>
    </ui-list>
    <ui-modal v-model="state.showModal" custom-content>
      <ui-card padding="p-0" class="w-full max-w-3xl">
        <div class="px-4 pt-4 flex items-center">
          <p class="flex-1">
            {{ t('workflow.conditionBuilder.title') }}
          </p>
          <v-remixicon
            name="riCloseLine"
            class="cursor-pointer"
            @click="state.showModal = false"
          />
        </div>
        <div
          class="overflow-auto p-4 mt-4 scroll"
          style="height: calc(100vh - 8rem)"
        >
          <input
            v-model="conditions[state.conditionsIndex].name"
            class="text-xl font-semibold mb-4 bg-transparent focus:ring-0"
          />
          <shared-condition-builder
            :autocomplete="autocomplete"
            :model-value="conditions[state.conditionsIndex].conditions"
            @change="conditions[state.conditionsIndex].conditions = $event"
          />
        </div>
      </ui-card>
    </ui-modal>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, shallowReactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { nanoid } from 'nanoid';
import emitter from '@/lib/mitt';
import SharedConditionBuilder from '@/components/newtab/shared/SharedConditionBuilder/index.vue';

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  blockId: {
    type: String,
    default: '',
  },
  autocomplete: {
    type: Array,
    default: () => [],
  },
});
const emit = defineEmits(['update:data']);

const conditionTypes = {
  '==': 'eq',
  '!=': 'nq',
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
  '()': 'cnt',
};
const { t } = useI18n();

const conditions = ref(props.data.conditions);
const state = shallowReactive({
  showModal: false,
  conditionsIndex: 0,
});

function editCondition(index) {
  state.conditionsIndex = index;
  state.showModal = true;
}
function addCondition() {
  if (conditions.value.length >= 10) return;

  emitter.emit('conditions-block:add', {
    id: props.blockId,
  });

  conditions.value.push({
    id: nanoid(),
    name: `Path ${conditions.value.length + 1}`,
    conditions: [],
  });
}
function deleteCondition(index) {
  conditions.value.splice(index, 1);

  emitter.emit('conditions-block:delete', {
    index,
    id: props.blockId,
  });
}

watch(
  conditions,
  () => {
    emit('update:data', {
      conditions: conditions.value,
    });
  },
  { deep: true }
);

onMounted(() => {
  const condition = props.data.conditions[0];

  if (condition && condition.conditions) return;

  const generateConditionItem = (type, data) => {
    if (type === 'value') {
      return {
        id: nanoid(),
        type: 'value',
        category: 'value',
        data: { value: data },
      };
    }

    return { id: nanoid(), category: 'compare', type: data };
  };
  conditions.value = conditions.value.map((item, index) => {
    const items = [
      generateConditionItem('value', item.compareValue),
      generateConditionItem('compare', conditionTypes[item.type]),
      generateConditionItem('value', item.value),
    ];

    return {
      id: nanoid(),
      name: `Path ${index + 1}`,
      conditions: [
        {
          id: nanoid(),
          conditions: [{ id: nanoid(), items }],
        },
      ],
    };
  });
});
</script>
