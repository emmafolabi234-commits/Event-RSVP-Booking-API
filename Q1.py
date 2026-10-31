""""
1. Create an empty dictionary to store each number and the index where it first appears.
2. Go through the list from left to right.
3. For each number, calculate the complement needed to reach the target: K - number.
4. If the complement is already in the dictionary, return the indices of the complement and current number.
5. Otherwise, store the current number and its index.
6. If no pair is found after checking the list, return “no pair found.”

ALGORITHM TwoSumUnsorted(M, K)
    positions ← empty dictionary

    FOR each index i from 0 to length(M) - 1
        number ← M[i]
        complement ← K - number

        IF complement is in positions
            RETURN (positions[complement], i)

        positions[number] ← i

    RETURN no pair found 
    
    """





def two_sum_unsorted(M, K):

    hash_table = {}
    
    for i, a in enumerate(M):
        if a<=K:   #checks if a<=K before adding to hashtable
            hash_table[a] = i
        
    for i, a in enumerate(M):
        if a<=K:
            b = K - a
        
        if b in hash_table and hash_table[b] != i:
            return (i, hash_table[b])



print(two_sum_unsorted([2, 7, 11, 15], 9))
print(two_sum_unsorted([3, 2, 4], 6))
print(two_sum_unsorted([3, 3], 6))
print(two_sum_unsorted([1, 5, 8, 3, 2], 11))



