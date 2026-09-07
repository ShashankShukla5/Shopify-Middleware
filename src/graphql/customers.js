const GET_CUSTOMER = `
  query GetCustomer($id: ID!) {
    customer(id: $id) {
      id
      email
      firstName
      lastName
      displayName
    }
  }
`;

module.exports = {
  GET_CUSTOMER,
};
