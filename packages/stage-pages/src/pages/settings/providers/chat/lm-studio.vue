<script setup lang="ts">
import type { RemovableRef } from '@vueuse/core'

import {
  ProviderBaseUrlInput,
  ProviderBasicSettings,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
  ProviderValidationAlerts,
} from '@proj-airi/stage-ui/components'
import { useProviderValidation } from '@proj-airi/stage-ui/composables/use-provider-validation'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'

const providerId = 'lm-studio'
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore) as { providers: RemovableRef<Record<string, any>> }

// Define computed properties for credentials

const baseUrl = computed({
  get: () => providers.value[providerId]?.baseUrl || '',
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].baseUrl = value
  },
})

// Use the composable to get validation logic and state
const {
  t,
  router,
  providerMetadata,
  isValidating,
  isValid,
  validationMessage,
  handleResetSettings,
  forceValid,
  hasManualValidators,
  isManualTesting,
  manualTestPassed,
  manualTestMessage,
  runManualTest,
} = useProviderValidation(providerId)

async function refetch() {
  try {
    const validationResult = await providerMetadata.value.validators.validateProviderConfig({
      baseUrl: baseUrl.value,
    })

    if (!validationResult.valid) {
      validationMessage.value = t('settings.dialogs.onboarding.validationError', {
        error: validationResult.reason,
      })
    }
  }
  catch (error) {
    validationMessage.value = t('settings.dialogs.onboarding.validationError', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

watch(baseUrl, refetch, { immediate: true })
onMounted(() => {
  providersStore.initializeProvider(providerId)
  baseUrl.value = providers.value[providerId]?.baseUrl || providerMetadata.value?.defaultOptions?.().baseUrl || ''
})
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName"
    :provider-icon-color="providerMetadata?.iconColor"
    :on-back="() => router.back()"
  >
    <ProviderSettingsContainer>
      <!-- Setup guide -->
      <div
        :class="['flex items-start gap-3 rounded-lg p-4', 'border border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20']"
      >
        <div i-solar:info-circle-line-duotone class="mt-0.5 text-xl text-primary-500 dark:text-primary-400" />
        <div :class="['flex flex-col gap-1 text-sm']">
          <span class="font-medium">{{ t('settings.pages.providers.provider.lm-studio.setup-guide.title') }}</span>
          <ol :class="['list-decimal pl-4 text-primary-700 dark:text-primary-300']">
            <li>{{ t('settings.pages.providers.provider.lm-studio.setup-guide.step1') }}</li>
            <li>{{ t('settings.pages.providers.provider.lm-studio.setup-guide.step2') }}</li>
            <li>{{ t('settings.pages.providers.provider.lm-studio.setup-guide.step3') }}</li>
            <li>{{ t('settings.pages.providers.provider.lm-studio.setup-guide.step4') }}</li>
          </ol>
        </div>
      </div>

      <ProviderBasicSettings
        :title="t('settings.pages.providers.common.section.basic.title')"
        :description="t('settings.pages.providers.common.section.basic.description')"
        :on-reset="handleResetSettings"
      >
        <ProviderBaseUrlInput
          v-model="baseUrl"
          placeholder="http://localhost:1234/v1/"
        />
      </ProviderBasicSettings>

      <!-- Validation Status -->
      <ProviderValidationAlerts
        :is-valid="isValid"
        :is-validating="isValidating"
        :validation-message="validationMessage"
        :has-manual-validators="hasManualValidators"
        :is-manual-testing="isManualTesting"
        :manual-test-passed="manualTestPassed"
        :manual-test-message="manualTestMessage"
        :on-run-test="runManualTest"
        :on-force-valid="forceValid"
        :on-go-to-model-selection="() => router.push('/settings/modules/consciousness')"
      />
    </ProviderSettingsContainer>
  </ProviderSettingsLayout>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
