import React from 'react';
import { View, Text, Button, TextInput, StyleSheet } from 'react-native';

// TypeScript example with hardcoded strings

interface Props {
  userName?: string;
  isLoggedIn: boolean;
}

interface State {
  message: string;
}

// Functional component with TypeScript
export const TypeScriptFunctional: React.FC<Props> = ({ userName, isLoggedIn }) => {
  const [email, setEmail] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = (): void => {
    if (!email) {
      setError("Email is required"); // Should be detected
    }
  };

  const getMessage = (): string => {
    return "Welcome to TypeScript Component"; // Should be detected
  };

  return (
    <View style={styles.container}>
      {/* Hardcoded strings in TSX */}
      <Text style={styles.title}>User Dashboard</Text>

      {/* Conditional rendering */}
      {isLoggedIn ? (
        <Text>Welcome back, {userName}!</Text>
      ) : (
        <Text>Please sign in to continue</Text>
      )}

      {/* Form elements */}
      <TextInput
        placeholder="Enter email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      {/* Error messages */}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* Buttons */}
      <Button title="Login" onPress={handleSubmit} />
      <Button title="Register" onPress={() => {}} />
      <Button title="Forgot Password?" onPress={() => {}} />

      {/* Function call */}
      <Text>{getMessage()}</Text>

      {/* Type annotations shouldn't interfere */}
      <Text>{"Total items: " + (10 as number)}</Text>

      {/* Status messages */}
      <Text>Loading user data...</Text>
      <Text>Data saved successfully</Text>
      <Text>Unable to connect to server</Text>
    </View>
  );
};

// Class component with TypeScript
export class TypeScriptClass extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      message: "Initial message", // This is state, not UI text
    };
  }

  render(): React.ReactNode {
    return (
      <View>
        <Text>Settings Panel</Text>
        <Text>Configure your preferences below</Text>

        {this.renderOptions()}
      </View>
    );
  }

  renderOptions(): React.ReactNode {
    return (
      <View>
        <Text>Notification Settings</Text>
        <Button title="Enable Notifications" onPress={this.handleToggle} />
        <Button title="Disable All" onPress={this.handleToggle} />
      </View>
    );
  }

  private handleToggle = (): void => {
    this.setState({ message: "Settings updated" });
  };

  private getStatusText(): string {
    return this.props.isLoggedIn
      ? "You are logged in"
      : "You are not logged in"; // Should be detected
  }
}

// Type definitions shouldn't be scanned
type MessageType = 'success' | 'error' | 'warning';

interface Config {
  apiUrl: string; // Property names are not UI strings
  timeout: number;
  retryAttempts: number;
}

// Enums with string values (these are technical, not UI)
enum ApiEndpoint {
  Login = '/api/login',
  Register = '/api/register',
  Profile = '/api/profile',
}

// Constants (technical values)
const API_BASE_URL = 'https://api.example.com';
const MAX_RETRIES = 3;

// UI component returning JSX with strings
const InfoCard: React.FC = () => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Important Notice</Text>
      <Text style={styles.cardBody}>
        Your account will be upgraded automatically.
      </Text>
      <Button title="Learn More" onPress={() => {}} />
    </View>
  );
};

// Helper function returning string
const formatError = (code: number): string => {
  switch (code) {
    case 404:
      return "Page not found"; // Should be detected
    case 500:
      return "Server error occurred"; // Should be detected
    default:
      return "An unexpected error occurred"; // Should be detected
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginVertical: 10,
  },
  error: {
    color: 'red',
  },
  card: {
    padding: 15,
    backgroundColor: '#f5f5f5',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardBody: {
    marginTop: 10,
  },
});

export default TypeScriptFunctional;
