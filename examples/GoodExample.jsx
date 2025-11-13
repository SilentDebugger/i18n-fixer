import React from 'react';
import { View, Text, Button, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

// This file shows properly internationalized code that should NOT be flagged

export const GoodExample = () => {
  const { t } = useTranslation();
  const [name, setName] = React.useState('');

  const getGreeting = () => {
    return t('welcome.greeting');
  };

  const renderError = () => {
    return <Text>{t('errors.general')}</Text>;
  };

  return (
    <View style={{ padding: 20 }}>
      {/* Properly i18n'd text */}
      <Text>{t('welcome.title')}</Text>

      {/* i18n'd button titles */}
      <Button title={t('buttons.clickMe')} />
      <Button title={t('buttons.submit')} />

      {/* i18n'd with interpolation */}
      <Text>{t('welcome.userGreeting', { name })}</Text>

      {/* Conditional rendering with i18n */}
      <Text>{name ? t('status.loggedIn') : t('status.pleaseLogin')}</Text>

      {/* Function call returning i18n string */}
      <Text>{getGreeting()}</Text>

      {/* Component rendering function with i18n */}
      {renderError()}

      {/* i18n'd placeholder text */}
      <TextInput placeholder={t('inputs.enterName')} />
      <TextInput placeholder={t('inputs.email')} />

      {/* Properly i18n'd attributes */}
      <Button
        title={t('buttons.save')}
        accessibilityLabel={t('accessibility.saveChanges')}
      />

      {/* Nested JSX with i18n */}
      <View>
        <Text>{t('profile.settings')}</Text>
        <View>
          <Text>{t('profile.manageAccount')}</Text>
        </View>
      </View>

      {/* Common UI strings - i18n'd */}
      <Button title={t('buttons.cancel')} />
      <Button title={t('buttons.ok')} />
      <Button title={t('buttons.delete')} />
      <Button title={t('buttons.edit')} />

      {/* These technical strings are OK to not be i18n'd */}
      <View testID="main-container" />
      <Text style={{ fontSize: 16 }} />
      <View className="container" />
      <Text id="unique-id" />

      {/* Color codes, URLs, paths - not flagged */}
      <View style={{ backgroundColor: '#FF5733' }} />
      <Text>{apiUrl}</Text>

      {/* Single characters and symbols - not flagged */}
      <Text>:</Text>
      <Text>-</Text>
      <Text>/</Text>
    </View>
  );
};

// Properly i18n'd class component
export class GoodClassComponent extends React.Component {
  constructor(props) {
    super(props);
    this.t = props.t; // Assuming passed via HOC
  }

  render() {
    return (
      <View>
        <Text>{this.t('class.title')}</Text>
        <Button title={this.t('buttons.press')} />
      </View>
    );
  }

  renderHeader() {
    return <Text>{this.t('header.title')}</Text>;
  }
}

// Edge cases that should NOT be flagged
export const EdgeCases = () => {
  const API_URL = 'https://api.example.com'; // URL - not flagged
  const testId = 'test-component'; // camelCase identifier - not flagged
  const COLOR = '#FFFFFF'; // Color code - not flagged

  return (
    <View>
      {/* Technical attributes */}
      <View testID={testId} />
      <Text style={{ color: COLOR }} />

      {/* Import paths */}
      <Image source={require('./assets/logo.png')} />

      {/* Data URIs */}
      <Image source={{ uri: 'data:image/png;base64,iVBORw0KG...' }} />
    </View>
  );
};
