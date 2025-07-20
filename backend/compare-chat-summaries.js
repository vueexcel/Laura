// Script to compare old and new chat summary formats

// Sample chat history with questions from different time periods
const mockChatHistory = [
  {
    id: '1',
    question: 'What is the weather like today?',
    response: 'Today is sunny with a high of 75°F.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    userId: 'test_user_id'
  },
  {
    id: '2',
    question: 'Can you recommend a good restaurant for dinner?',
    response: 'I recommend trying the new Italian place downtown called Bella Pasta. They have excellent reviews.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    userId: 'test_user_id'
  },
  {
    id: '3',
    question: 'What movies are playing this weekend?',
    response: 'The new Marvel movie and a romantic comedy called "Love in Paris" are both premiering this weekend.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    userId: 'test_user_id'
  },
  {
    id: '4',
    question: 'How do I make chocolate chip cookies?',
    response: 'Here\'s a simple recipe for chocolate chip cookies: Mix 1 cup butter, 1 cup sugar, 2 eggs...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    userId: 'test_user_id'
  },
  {
    id: '5',
    question: 'What\'s the best way to learn a new language?',
    response: 'The best way to learn a new language is through consistent practice, immersion, and using apps like Duolingo...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 1 week ago
    userId: 'test_user_id'
  },
  {
    id: '6',
    question: 'Can you help me plan a vacation to Europe?',
    response: 'I\'d be happy to help you plan a vacation to Europe! Some popular destinations include Paris, Rome, Barcelona...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14), // 2 weeks ago
    userId: 'test_user_id'
  }
];

// Old generateChatSummary function (focusing on conversation content)
function oldGenerateChatSummary(chatHistory) {
  if (!chatHistory || chatHistory.length === 0) {
    return "No previous conversation history.";
  }

  // Simulate GPT response with a general conversation summary
  const oldSummary = "The user asked questions from different time periods: today, yesterday, and 15 days ago. Laura responded to each accordingly, indicating the timing of each interaction. The conversation covered topics like weather, restaurants, movies, cooking, language learning, and travel planning.";
  
  return oldSummary;
}

// New generateChatSummary function (focusing on user questions)
function newGenerateChatSummary(chatHistory) {
  if (!chatHistory || chatHistory.length === 0) {
    return "No previous conversation history.";
  }

  // Simulate GPT response with a focus on user questions
  const newSummary = `Here's a summary of your recent questions:

• Today: "What is the weather like today?"
• Today: "Can you recommend a good restaurant for dinner?"
• Yesterday: "What movies are playing this weekend?"
• 3 days ago: "How do I make chocolate chip cookies?"
• 1 week ago: "What's the best way to learn a new language?"
• 2 weeks ago: "Can you help me plan a vacation to Europe?"

You've asked about daily information (weather, restaurants, movies), practical skills (cooking, language learning), and travel planning.`;
  
  return newSummary;
}

// Fallback summary (if GPT fails)
function fallbackSummary(chatHistory) {
  let summary = "Here's a summary of your recent questions:\n\n";
  
  for (const chat of chatHistory) {
    const questionSummary = chat.question.length > 100 ? 
      `${chat.question.substring(0, 97)}...` : chat.question;
    
    summary += `• ${questionSummary}\n`;
  }
  
  return summary;
}

// Compare the summaries
console.log('Comparing Old vs New Chat Summary Formats');
console.log('==========================================');

console.log('\nOLD SUMMARY FORMAT (General conversation content):');
console.log('------------------------------------------------');
console.log(oldGenerateChatSummary(mockChatHistory));
console.log('------------------------------------------------');

console.log('\nNEW SUMMARY FORMAT (Focus on user questions):');
console.log('------------------------------------------------');
console.log(newGenerateChatSummary(mockChatHistory));
console.log('------------------------------------------------');

console.log('\nFALLBACK SUMMARY (If GPT fails):');
console.log('------------------------------------------------');
console.log(fallbackSummary(mockChatHistory));
console.log('------------------------------------------------');

console.log('\nCHAT SUMMARY DOCUMENT STRUCTURE:');
console.log('------------------------------------------------');
console.log(JSON.stringify({
  userId: 'test_user_id',
  summary: newGenerateChatSummary(mockChatHistory),
  lastUpdated: new Date().toISOString()
}, null, 2));
console.log('------------------------------------------------');