""""
1. Set left to the first index and right to the last index of the descending-order array.
2. reate an empty list of result pairs.
3. While left is less than right:
        Add the values at left and right.
        If their sum equals the target, add their indices to the results, then move both pointers inward.
        If the sum is greater than the target, move left rightward to try a smaller value.
        If the sum is less than the target, move right leftward to try a larger value.
4. Return the result list. It is empty if no pair was found.

ALGORITHM TwoSumDescending(arr, target)
    left ← 0
    right ← length(arr) - 1
    results ← empty list

    WHILE left < right
        currentSum ← arr[left] + arr[right]

        IF currentSum = target
            append (left, right) to results
            left ← left + 1
            right ← right - 1
        ELSE IF currentSum > target
            left ← left + 1
        ELSE
            right ← right - 1

    RETURN results

"""


def two_sum_descending(arr, K):
    left = 0
    right = len(arr) - 1
    results = []
    
    while left < right:
        current_sum = arr[left] + arr[right]
        
        if current_sum == K:
            results.append([left, right])
            left += 1  
            right -= 1  
        elif current_sum > K:
            left += 1   
        else:
            right -= 1  
            
    return results

M = [20, 14, 11, 8, 4, 1]
K = 15

print(two_sum_descending(M, K))
print(two_sum_descending([15, 11, 7, 2], 9)) 
print(two_sum_descending([10, 8, 5, 3, 2, 1], 10)) 
print(two_sum_descending([20, 14, 11, 8, 4, 1], 15)) 
print(two_sum_descending([9, 7, 4, 3, 1], 10))
