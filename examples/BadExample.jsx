import React from 'react';
import { View, Text, Button, TextInput } from 'react-native';

// This file contains many hardcoded strings that should be i18n'd

export const BadExample = () => {
  const [name, setName] = React.useState('');

  const getGreeting = () => {
    return "Hello, welcome to our app!"; // Should be detected
  };

  const renderError = () => {
    return <Text>Something went wrong. Please try again.</Text>; // Should be detected
  };

  return (
    <View>
      {/* Direct text in JSX */}
      <Text>Welcome to the App</Text>

      {/* Text in attributes */}
      <Button title="Click Me" />
      <Button title="Submit Form" />

      {/* String in expression */}
      <Text>{"Hello World"}</Text>

      {/* Template literals */}
      <Text>{`Welcome ${name}`}</Text>

      {/* Conditional rendering with strings */}
      <Text>{name ? "User logged in" : "Please log in"}</Text>

      {/* Function call returning string */}
      <Text>{getGreeting()}</Text>

      {/* Component rendering function */}
      {renderError()}

      {/* Placeholder text */}
      <TextInput placeholder="Enter your name" />
      <TextInput placeholder="Email address" />

      {/* Multiple strings in attributes */}
      <Button
        title="Save Changes"
        accessibilityLabel="Save your changes"
      />

      {/* Nested JSX with strings */}
      <View>
        <Text>Profile Settings</Text>
        <View>
          <Text>Manage your account</Text>
        </View>
      </View>

      {/* String concatenation */}
      <Text>{"Total: " + "100"}</Text>

      {/* Common UI strings */}
      <Button title="Cancel" />
      <Button title="OK" />
      <Button title="Delete" />
      <Button title="Edit" />
      <Button title="Save" />

      {/* Error messages */}
      <Text>Invalid email address</Text>
      <Text>Password must be at least 8 characters</Text>

      {/* Labels */}
      <Text>Username:</Text>
      <Text>Password:</Text>
      <Text>Email:</Text>

      {/* Status messages */}
      <Text>Loading...</Text>
      <Text>Success!</Text>
      <Text>Failed to load data</Text>
    </View>
  );
};

// Class component example
export class BadClassComponent extends React.Component {
  render() {
    return (
      <View>
        <Text>This is a class component</Text>
        <Button title="Press me" onPress={() => alert("Button pressed!")} />
      </View>
    );
  }

  renderHeader() {
    return <Text>Header Title</Text>;
  }
}

// Functional component returning conditional strings
export const StatusMessage = ({ isSuccess }) => {
  return isSuccess ? "Operation completed successfully" : "Operation failed";
};
