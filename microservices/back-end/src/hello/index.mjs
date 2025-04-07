export const handler = async (event) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      msg: "Hello World!",
    }),
  };
  return response;
};
